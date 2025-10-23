/**
 * Attachment Store
 *
 * Manages file attachment state including uploads and metadata.
 * This is a server state store that fetches and caches attachment data.
 */
import { makeObservable, observable, computed } from "mobx";
import { attachmentServiceClient } from "@/grpcweb";
import { CreateAttachmentRequest, Attachment, UpdateAttachmentRequest } from "@/types/proto/api/v1/attachment_service";
import { StandardState, createServerStore } from "./base-store";
import { createRequestKey } from "./store-utils";

/**
 * Attachment store state
 * Uses a name-based map for efficient lookups
 */
class AttachmentState extends StandardState {
  /**
   * Map of attachments indexed by resource name (e.g., "attachments/123")
   */
  attachmentMapByName: Record<string, Attachment> = {};

  constructor() {
    super();
    makeObservable(this, {
      attachmentMapByName: observable,
      attachments: computed,
      size: computed,
    });
  }

  /**
   * Computed getter for all attachments as an array
   */
  get attachments(): Attachment[] {
    return Object.values(this.attachmentMapByName);
  }

  /**
   * Get attachment count
   */
  get size(): number {
    return Object.keys(this.attachmentMapByName).length;
  }
}

/**
 * Attachment store instance
 */
const attachmentStore = (() => {
  const base = createServerStore(new AttachmentState(), {
    name: "attachment",
    enableDeduplication: true,
  });

  const { state, executeRequest } = base;

  /**
   * Fetch attachment by resource name
   * Results are cached in the store
   *
   * @param name - Resource name (e.g., "attachments/123")
   * @returns The attachment object
   */
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

  /**
   * Get attachment from cache by resource name
   * Does not trigger a fetch if not found
   *
   * @param name - Resource name
   * @returns The cached attachment or undefined
   */
  const getAttachmentByName = (name: string): Attachment | undefined => {
    return state.attachmentMapByName[name];
  };

  /**
   * Get or fetch attachment by name
   * Checks cache first, fetches if not found
   *
   * @param name - Resource name
   * @returns The attachment object
   */
  const getOrFetchAttachmentByName = async (name: string): Promise<Attachment> => {
    const cached = getAttachmentByName(name);
    if (cached) {
      return cached;
    }
    return fetchAttachmentByName(name);
  };

  /**
   * Create a new attachment
   *
   * @param request - Attachment creation request
   * @returns The created attachment
   */
  const createAttachment = async (request: CreateAttachmentRequest): Promise<Attachment> => {
    return executeRequest(
      "", // No deduplication for creates
      async () => {
        const attachment = await attachmentServiceClient.createAttachment(request);

        // Add to cache
        state.setPartial({
          attachmentMapByName: {
            ...state.attachmentMapByName,
            [attachment.name]: attachment,
          },
        });

        return attachment;
      },
      "CREATE_ATTACHMENT_FAILED",
    );
  };

  /**
   * Update an existing attachment
   *
   * @param request - Attachment update request
   * @returns The updated attachment
   */
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

  /**
   * Delete an attachment
   *
   * @param name - Resource name of the attachment to delete
   */
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

  /**
   * Clear all cached attachments
   */
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
