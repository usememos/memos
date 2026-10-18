import { create } from "@bufbuild/protobuf";
import { FieldMaskSchema } from "@bufbuild/protobuf/wkt";
import type { MemoSaveOperations } from "@/components/MemoEditor/edit/services/memoService";
import { memoServiceClient } from "@/connect";
import { MemoSchema } from "@/types/proto/api/memo_service_pb";

/**
 * Save operations over the bare (mocked) client, shaping requests as the memo
 * mutation hooks do, for tests of the service's own logic.
 */
export const clientSaveOperations: MemoSaveOperations = {
  getMemo: (name) => memoServiceClient.getMemo({ name }),
  updateMemo: (update, paths) =>
    memoServiceClient.updateMemo({
      memo: create(MemoSchema, update as Record<string, unknown>),
      updateMask: create(FieldMaskSchema, { paths }),
    }),
  createMemo: (memo, parent) =>
    parent ? memoServiceClient.createMemoComment({ parent, comment: memo }) : memoServiceClient.createMemo({ memo }),
};
