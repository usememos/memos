import { uniqueId } from "lodash-es";
import { create } from "zustand";
import { combine } from "zustand/middleware";
import { memoServiceClient } from "@/grpcweb";
import { PetData, PetMemoWithData } from "@/pages/RawDataView/Pet";
import { NodeType } from "@/types/proto/api/v1/markdown_service";
import { ListMemosRequest, Memo, MemoView } from "@/types/proto/api/v1/memo_service";

// Animals to exclude from plant care events
export const ANIMAL_NICKNAMES = ["大福"];

interface State {
  stateId: string;
  petMemos: Record<string, PetMemoWithData>;
  bookMemos: Record<string, Memo>;
  videoMemos: Record<string, Memo>;
  isLoading: boolean;
  currentRequest: AbortController | null;
}

const getDefaultState = (): State => ({
  stateId: uniqueId(),
  petMemos: {},
  bookMemos: {},
  videoMemos: {},
  isLoading: false,
  currentRequest: null,
});

export const useRawDataStore = create(
  combine(getDefaultState(), (set, get) => ({
    setState: (state: Partial<State>) => set(state),
    getState: () => get(),
    updateStateId: () => set({ stateId: uniqueId() }),

    // Fetch memos with filter string (component builds the filter like Home page does)
    fetchRawMemos: async (filter: string, type: "pet" | "book" | "video") => {
      const currentRequest = get().currentRequest;
      if (currentRequest) {
        currentRequest.abort();
      }

      const controller = new AbortController();
      set({ currentRequest: controller, isLoading: true });

      try {
        console.log("[RawDataStore] Fetching memos with filter:", filter);

        const { memos } = await memoServiceClient.listMemos(
          {
            filter,
            view: MemoView.MEMO_VIEW_FULL,
            pageSize: 200,
          } as ListMemosRequest,
          { signal: controller.signal },
        );

        console.log(`[RawDataStore] Found ${memos.length} memos`);

        if (!controller.signal.aborted) {
          if (type === "pet") {
            // Parse and filter pet memos
            const petMemoMap: Record<string, PetMemoWithData> = {};

            for (const memo of memos) {
              const codeBlocks = memo.nodes.filter((node) => node.type === NodeType.CODE_BLOCK && node.codeBlockNode?.language === "json");

              // Skip if no code blocks
              if (codeBlocks.length === 0) continue;

              // Parse first valid JSON code block
              let petData: PetData | null = null;
              for (const codeBlock of codeBlocks) {
                try {
                  const data = JSON.parse(codeBlock.codeBlockNode?.content || "{}");
                  petData = data as PetData;
                  break;
                } catch (e) {
                  continue;
                }
              }

              // Skip if no valid JSON, has endDate, or is a template
              if (!petData || petData.endDate !== undefined || petData.template === true) continue;

              petMemoMap[memo.name] = {
                memo,
                petData,
              };
            }

            set({
              stateId: uniqueId(),
              petMemos: petMemoMap,
              isLoading: false,
            });

            return Object.values(petMemoMap).map((item) => item.memo);
          } else {
            // Handle book and video memos (unchanged)
            const memoMap: Record<string, Memo> = {};
            for (const memo of memos) {
              memoMap[memo.name] = memo;
            }

            const updateKey = type === "book" ? "bookMemos" : "videoMemos";
            set({
              stateId: uniqueId(),
              [updateKey]: memoMap,
              isLoading: false,
            });

            return memos;
          }
        }
      } catch (error: any) {
        if (error.name === "AbortError") {
          return [];
        }
        console.error("[RawDataStore] Error fetching memos:", error);
        set({ isLoading: false });
        throw error;
      } finally {
        if (get().currentRequest === controller) {
          set({ currentRequest: null, isLoading: false });
        }
      }

      return [];
    },

    // Get pet memos with parsed data
    getPetMemos: () => {
      return Object.values(get().petMemos);
    },

    // Get pet memos (raw Memo objects only)
    getPetMemosRaw: () => {
      return Object.values(get().petMemos).map((item) => item.memo);
    },

    // Get book memos
    getBookMemos: () => {
      return Object.values(get().bookMemos);
    },

    // Get video memos
    getVideoMemos: () => {
      return Object.values(get().videoMemos);
    },

    // Clear all data
    clearAll: () => {
      set(getDefaultState());
    },
  })),
);
