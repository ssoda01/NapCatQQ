import { ActionName } from '@/onebot/action/router';
import { GetPacketStatusDepends } from '@/onebot/action/packet/GetPacketStatus';
import { MiniAppInfo, MiniAppInfoHelper } from '@/core/packet/utils/helper/miniAppHelper';
import { MiniAppData, MiniAppRawData, MiniAppReqCustomParams, MiniAppReqParams } from '@/core/packet/entities/miniApp';
import { z } from 'zod';

const SchemaData = z.union([
    z.object({
        type: z.union([z.literal('bili'), z.literal('weibo')]),
        title: z.string(),
        desc: z.string(),
        picUrl: z.string(),
        jumpUrl: z.string(),
        webUrl: z.string().optional(),
        rawArkData: z.string().optional()
    }),
    z.object({
        title: z.string(),
        desc: z.string(),
        picUrl: z.string(),
        jumpUrl: z.string(),
        iconUrl: z.string(),
        webUrl: z.string().optional(),
        appId: z.string(),
        scene: z.union([z.number(), z.string()]),
        templateType: z.union([z.number(), z.string()]),
        businessType: z.union([z.number(), z.string()]),
        verType: z.union([z.number(), z.string()]),
        shareType: z.union([z.number(), z.string()]),
        versionId: z.string(),
        sdkId: z.string(),
        withShareTicket: z.union([z.number(), z.string()]),
        rawArkData: z.string().optional()
    })
]);
type Payload = z.infer<typeof SchemaData>;

export class GetMiniAppArk extends GetPacketStatusDepends<Payload, {
    data: MiniAppData | MiniAppRawData
}> {
    override actionName = ActionName.GetMiniAppArk;
    override payloadSchema = SchemaData;

    async _handle(payload: Payload) {
        let reqParam: MiniAppReqParams;
        const customParams = {
            title: payload.title,
            desc: payload.desc,
            picUrl: payload.picUrl,
            jumpUrl: payload.jumpUrl,
            webUrl: payload.webUrl,
        } as MiniAppReqCustomParams;
        if ('type' in payload) {
            reqParam = MiniAppInfoHelper.generateReq(customParams, MiniAppInfo.get(payload.type)!.template);
        } else {
            const { appId, scene, iconUrl, templateType, businessType, verType, shareType, versionId, withShareTicket } = payload;
            reqParam = MiniAppInfoHelper.generateReq(
                customParams,
                {
                    sdkId: payload.sdkId ?? MiniAppInfo.sdkId,
                    appId: appId,
                    scene: +scene,
                    iconUrl: iconUrl,
                    templateType: +templateType,
                    businessType: +businessType,
                    verType: +verType,
                    shareType: +shareType,
                    versionId: versionId,
                    withShareTicket: +withShareTicket,
                }
            );
        }
        const arkData = await this.core.apis.PacketApi.pkt.operation.GetMiniAppAdaptShareInfo(reqParam);
        return {
            data: payload.rawArkData === 'true' ? arkData : MiniAppInfoHelper.RawToSend(arkData)
        };
    }
}
