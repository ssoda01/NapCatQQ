import {InstanceContext, NapCatCore} from '..';
import * as os from 'os';
import offset from '@/core/external/offset.json';
import * as crypto from 'crypto';
import {PacketClient} from '../helper/packet/client';
import {PacketHexStr, PacketPacker} from "@/core/helper/packet/packer";
import {NapProtoMsg} from '../proto/NapProto';
import {OidbSvcTrpcTcp0X9067_202_Rsp_Body} from '../proto/oidb/Oidb.0x9067_202';
import {OidbSvcTrpcTcpBase, OidbSvcTrpcTcpBaseRsp} from '../proto/oidb/OidbBase';
import {OidbSvcTrpcTcp0XFE1_2RSP} from '../proto/oidb/Oidb.fe1_2';

interface OffsetType {
    [key: string]: {
        recv: string;
        send: string;
    };
}

const typedOffset: OffsetType = offset;

export class NTQQPacketApi {
    context: InstanceContext;
    core: NapCatCore;
    serverUrl: string | undefined;
    qqversion: string | undefined;
    isInit: boolean = false;
    packetPacker: PacketPacker;
    packetClient: PacketClient | undefined;

    constructor(context: InstanceContext, core: NapCatCore) {
        this.context = context;
        this.core = core;
        this.packetPacker = new PacketPacker();
        let config = this.core.configLoader.configData;
        if (config && config.packetServer && config.packetServer.length > 0) {
            let serverurl = this.core.configLoader.configData.packetServer ?? '127.0.0.1:8086';
            this.InitSendPacket(serverurl, this.context.basicInfoWrapper.getFullQQVesion())
                .then()
                .catch(this.core.context.logger.logError.bind(this.core.context.logger));
        }
    }

    async InitSendPacket(serverUrl: string, qqversion: string) {
        this.serverUrl = serverUrl;
        this.qqversion = qqversion;
        let offsetTable: OffsetType = offset;
        let table = offsetTable[qqversion + '-' + os.arch()];
        if (!table) return false;
        let url = 'ws://' + this.serverUrl + '/ws';
        this.packetClient = new PacketClient(url, this.core.context.logger);
        await this.packetClient.connect();
        await this.packetClient.init(process.pid, table.recv, table.send);
        this.isInit = true;
        return this.isInit;
    }

    randText(len: number) {
        let text = '';
        let possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        for (let i = 0; i < len; i++) {
            text += possible.charAt(Math.floor(Math.random() * possible.length));
        }
        return text;
    }

    async sendPacket(cmd: string, data: PacketHexStr, rsp = false): Promise<any> {
        // wtfk tx
        // 校验失败和异常 可能返回undefined
        return new Promise((resolve, reject) => {
            if (!this.isInit || !this.packetClient?.isConnected) {
                this.core.context.logger.logError('packetClient is not init');
                return undefined;
            }
            let md5 = crypto.createHash('md5').update(data).digest('hex');
            let trace_id = (this.randText(4) + md5 + data).slice(0, data.length / 2);
            this.packetClient?.sendCommand(cmd, data, trace_id, rsp, 5000, async () => {
                await this.core.context.session.getMsgService().sendSsoCmdReqByContend(cmd, trace_id);
            }).then((res) => resolve(res)).catch((e) => reject(e));
        });
    }

    async sendPokePacket(group: number, peer: number) {
        let data = this.core.apis.PacketApi.packetPacker.packPokePacket(group, peer);
        let ret = await this.core.apis.PacketApi.sendPacket('OidbSvcTrpcTcp.0xed3_1', data, false);
        //console.log('ret: ', ret);
    }

    async sendRkeyPacket() {
        let packet = this.packetPacker.packRkeyPacket();
        let ret = await this.core.apis.PacketApi.sendPacket('OidbSvcTrpcTcp.0x9067_202', packet, true);
        if (!ret?.hex_data) return []
        let body = new NapProtoMsg(OidbSvcTrpcTcpBaseRsp).decode(Buffer.from(ret.hex_data, 'hex')).body;
        //console.log('ret: ', Buffer.from(body).toString('hex'));
        let retData = new NapProtoMsg(OidbSvcTrpcTcp0X9067_202_Rsp_Body).decode(body)
        //console.log('ret: ', JSON.stringify(retData.data.rkeyList));
        return retData.data.rkeyList;
    }

    async sendStatusPacket(uin: number): Promise<{ status: number; ext_status: number; } | undefined> {
        let status = 0;
        try {
            let packet = this.packetPacker.packStatusPacket(uin);
            let ret = await this.core.apis.PacketApi.sendPacket('OidbSvcTrpcTcp.0xfe1_2', packet, true);
            console.log('ret: ', ret);
            let data = Buffer.from(ret.hex_data, 'hex');
            let ext = new NapProtoMsg(OidbSvcTrpcTcp0XFE1_2RSP).decode(new NapProtoMsg(OidbSvcTrpcTcpBase).decode(data).body).data.status.value;
            // ext & 0xff00 + ext >> 16 & 0xff
            let extBigInt = BigInt(ext); // 转换为 BigInt
            if (extBigInt <= 10n) {
                return {status: Number(extBigInt) * 10, ext_status: 0};
            }
            status = Number((extBigInt & 0xff00n) + ((extBigInt >> 16n) & 0xffn)); // 使用 BigInt 操作符
            return {status: 10, ext_status: status};
        } catch (error) {
            return undefined
        }
    }
}
