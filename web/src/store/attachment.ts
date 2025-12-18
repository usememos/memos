// Attachment Store - manages file attachment state including uploads and metadata
import { computed, makeObservable, observable } from "mobx";
import { attachmentServiceClient } from "@/connect";
import { Attachment, CreateAttachmentRequest, UpdateAttachmentRequest } from "@/types/proto/api/v1/attachment_service_pb";
import { createServerStore, StandardState } from "./base-store";
import { createRequestKey } from "./store-utils";

class AttachmentState extends StandardState {
  // Map of attachments indexed by resource name (e.g., "attachments/123")
  attachmentMapByName: Record<string, Attachment> = {};

  constructor() {
    super();
    makeObservable(this, {
      attachmentMapByName: observable,
      attachments: computed,
      size: computed,
    });
  }

  get attachments(): Attachment[] {
    return Object.values(this.attachmentMapByName);
  }

  get size(): number {
    return Object.keys(this.attachmentMapByName).length;
  }
}

const attachmentStore = (() => {
  const base = createServerStore(new AttachmentState(), {
    name: "attachment",
    enableDeduplication: true,
  });

  const { state, executeRequest } = base;

  const fetchAttachmentByName = async (name: string): Promise<Attachment> => {
    const requestKey = createRequestKey("fetchAttachment", { name });

    return executeRequest(
      requestKey,
      async () => {
        const attachment = await attachmentServiceClient.getAttachment({ name });

        // Update cache
        state.setPartial({
          attachmentMapByName: {
            ...state.attachmentMapByName,
            [attachment.name]: attachment,
          },
        });

        return attachment;
      },
      "FETCH_ATTACHMENT_FAILED",
    );
  };

  const getAttachmentByName = (name: string): Attachment | undefined => {
    return state.attachmentMapByName[name];
  };

  const getOrFetchAttachmentByName = async (name: string): Promise<Attachment> => {
    const cached = getAttachmentByName(name);
    if (cached) {
      return cached;
    }
    return fetchAttachmentByName(name);
  };

  const createAttachment = async (attachment: Attachment): Promise<Attachment> => {
    return executeRequest(
      "", // No deduplication for creates
      async () => {
        const result = await attachmentServiceClient.createAttachment({ attachment });

        // Add to cache
        state.setPartial({
          attachmentMapByName: {
            ...state.attachmentMapByName,
            [result.name]: result,
          },
        });

        return result;
      },
      "CREATE_ATTACHMENT_FAILED",
    );
  };

  const updateAttachment = async (request: UpdateAttachmentRequest): Promise<Attachment> => {
    return executeRequest(
      "", // No deduplication for updates
      async () => {
        const attachment = await attachmentServiceClient.updateAttachment(request);

        // Update cache
        state.setPartial({
          attachmentMapByName: {
            ...state.attachmentMapByName,
            [attachment.name]: attachment,
          },
        });

        return attachment;
      },
      "UPDATE_ATTACHMENT_FAILED",
    );
  };

  const deleteAttachment = async (name: string): Promise<void> => {
    return executeRequest(
      "", // No deduplication for deletes
      async () => {
        await attachmentServiceClient.deleteAttachment({ name });

        // Remove from cache
        const attachmentMap = { ...state.attachmentMapByName };
        delete attachmentMap[name];
        state.setPartial({ attachmentMapByName: attachmentMap });
      },
      "DELETE_ATTACHMENT_FAILED",
    );
  };

  const clearCache = (): void => {
    state.setPartial({ attachmentMapByName: {} });
  };

  return {
    state,
    fetchAttachmentByName,
    getAttachmentByName,
    getOrFetchAttachmentByName,
    createAttachment,
    updateAttachment,
    deleteAttachment,
    clearCache,
  };
})();

export default attachmentStore;
