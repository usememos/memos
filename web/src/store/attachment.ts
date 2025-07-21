import { makeAutoObservable } from "mobx";
import { attachmentServiceClient } from "@/grpcweb";
import { CreateAttachmentRequest, Attachment, UpdateAttachmentRequest } from "@/types/proto/api/v1/attachment_service";

class LocalState {
  attachmentMapByName: Record<string, Attachment> = {};

  constructor() {
    makeAutoObservable(this);
  }

  setPartial(partial: Partial<LocalState>) {
    Object.assign(this, partial);
  }
}

const attachmentStore = (() => {
  const state = new LocalState();

  const fetchAttachmentByName = async (name: string) => {
    const attachment = await attachmentServiceClient.getAttachment({
      name,
    });
    const attachmentMap = { ...state.attachmentMapByName };
    attachmentMap[attachment.name] = attachment;
    state.setPartial({ attachmentMapByName: attachmentMap });
    return attachment;
  };

  const getAttachmentByName = (name: string) => {
    return Object.values(state.attachmentMapByName).find((a) => a.name === name);
  };

  const createAttachment = async (create: CreateAttachmentRequest): Promise<Attachment> => {
    const attachment = await attachmentServiceClient.createAttachment(create);
    const attachmentMap = { ...state.attachmentMapByName };
    attachmentMap[attachment.name] = attachment;
    state.setPartial({ attachmentMapByName: attachmentMap });
    return attachment;
  };

  const updateAttachment = async (update: UpdateAttachmentRequest): Promise<Attachment> => {
    const attachment = await attachmentServiceClient.updateAttachment(update);
    const attachmentMap = { ...state.attachmentMapByName };
    attachmentMap[attachment.name] = attachment;
    state.setPartial({ attachmentMapByName: attachmentMap });
    return attachment;
  };

  return {
    state,
    fetchAttachmentByName,
    getAttachmentByName,
    createAttachment,
    updateAttachment,
  };
})();

export default attachmentStore;
