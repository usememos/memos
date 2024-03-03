import { memoServiceClient } from "@/grpcweb";
import { useGlobalStore } from "@/store/module";
import { Node } from "@/types/node";
import { Memo } from "@/types/proto/api/v2/memo_service";

export const useMemoParser = () => {
  const { systemStatus } = useGlobalStore().state;

  return {
    getNodes: (memo: Memo): Node[] => (memo?.nodes.length ? memo.nodes : window.parse(memo.content)),
    parseOrFetchNodes: async (content: string): Promise<Node[]> => {
      if (systemStatus.serverSideMarkdown) {
        const response = await memoServiceClient.previewMemoContent({
          content: content,
        });

        return response.nodes;
      }

      return window.parse(content);
    },
  };
};
