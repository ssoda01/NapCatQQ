import { OB11Group } from '@/onebot';
import { OB11Construct } from '@/onebot/helper/data';
import { OneBotAction } from '@/onebot/action/OneBotAction';
import { ActionName } from '@/onebot/action/router';
import { z } from 'zod';

const SchemaData = z.object({
    group_id: z.union([z.number(), z.string()]),
});

type Payload = z.infer<typeof SchemaData>;

class GetGroupInfo extends OneBotAction<Payload, OB11Group> {
    override actionName = ActionName.GetGroupInfo;
    override payloadSchema = SchemaData;

    async _handle(payload: Payload) {
        const group = (await this.core.apis.GroupApi.getGroups()).find(e => e.groupCode == payload.group_id.toString());
        if (!group) {
            const data = await this.core.apis.GroupApi.fetchGroupDetail(payload.group_id.toString());
            return {
                ...data,
                group_all_shut: data.shutUpAllTimestamp > 0 ? -1 : 0,
                group_remark: '',
                group_id: +payload.group_id,
                group_name: data.groupName,
                member_count: data.memberNum,
                max_member_count: data.maxMemberNum,
            };
        }
        return OB11Construct.group(group);
    }
}

export default GetGroupInfo;
