/* eslint-disable */
import Long from "long";
import _m0 from "protobufjs/minimal";
import { RowStatus } from "./common";

export const protobufPackage = "memos.api.v2";

export enum Visibility {
  VISIBILITY_UNSPECIFIED = 0,
  PRIVATE = 1,
  PROTECTED = 2,
  PUBLIC = 3,
  UNRECOGNIZED = -1,
}

export interface Memo {
  id: number;
  rowStatus: RowStatus;
  creatorId: number;
  createdTs: number;
  updatedTs: number;
  content: string;
  visibility: Visibility;
  pinned: boolean;
}

export interface ListMemosRequest {
  page: number;
  pageSize: number;
  /** Filter is used to filter memos returned in the list. */
  filter: string;
}

export interface ListMemosResponse {
  memos: Memo[];
}

export interface GetMemoRequest {
  id: number;
}

export interface GetMemoResponse {
  memo?: Memo | undefined;
}

function createBaseMemo(): Memo {
  return { id: 0, rowStatus: 0, creatorId: 0, createdTs: 0, updatedTs: 0, content: "", visibility: 0, pinned: false };
}

export const Memo = {
  encode(message: Memo, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.id !== 0) {
      writer.uint32(8).int32(message.id);
    }
    if (message.rowStatus !== 0) {
      writer.uint32(16).int32(message.rowStatus);
    }
    if (message.creatorId !== 0) {
      writer.uint32(24).int32(message.creatorId);
    }
    if (message.createdTs !== 0) {
      writer.uint32(32).int64(message.createdTs);
    }
    if (message.updatedTs !== 0) {
      writer.uint32(40).int64(message.updatedTs);
    }
    if (message.content !== "") {
      writer.uint32(50).string(message.content);
    }
    if (message.visibility !== 0) {
      writer.uint32(56).int32(message.visibility);
    }
    if (message.pinned === true) {
      writer.uint32(64).bool(message.pinned);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): Memo {
    const reader = input instanceof _m0.Reader ? input : _m0.Reader.create(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseMemo();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          if (tag !== 8) {
            break;
          }

          message.id = reader.int32();
          continue;
        case 2:
          if (tag !== 16) {
            break;
          }

          message.rowStatus = reader.int32() as any;
          continue;
        case 3:
          if (tag !== 24) {
            break;
          }

          message.creatorId = reader.int32();
          continue;
        case 4:
          if (tag !== 32) {
            break;
          }

          message.createdTs = longToNumber(reader.int64() as Long);
          continue;
        case 5:
          if (tag !== 40) {
            break;
          }

          message.updatedTs = longToNumber(reader.int64() as Long);
          continue;
        case 6:
          if (tag !== 50) {
            break;
          }

          message.content = reader.string();
          continue;
        case 7:
          if (tag !== 56) {
            break;
          }

          message.visibility = reader.int32() as any;
          continue;
        case 8:
          if (tag !== 64) {
            break;
          }

          message.pinned = reader.bool();
          continue;
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skipType(tag & 7);
    }
    return message;
  },

  create(base?: DeepPartial<Memo>): Memo {
    return Memo.fromPartial(base ?? {});
  },

  fromPartial(object: DeepPartial<Memo>): Memo {
    const message = createBaseMemo();
    message.id = object.id ?? 0;
    message.rowStatus = object.rowStatus ?? 0;
    message.creatorId = object.creatorId ?? 0;
    message.createdTs = object.createdTs ?? 0;
    message.updatedTs = object.updatedTs ?? 0;
    message.content = object.content ?? "";
    message.visibility = object.visibility ?? 0;
    message.pinned = object.pinned ?? false;
    return message;
  },
};

function createBaseListMemosRequest(): ListMemosRequest {
  return { page: 0, pageSize: 0, filter: "" };
}

export const ListMemosRequest = {
  encode(message: ListMemosRequest, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.page !== 0) {
      writer.uint32(8).int32(message.page);
    }
    if (message.pageSize !== 0) {
      writer.uint32(16).int32(message.pageSize);
    }
    if (message.filter !== "") {
      writer.uint32(26).string(message.filter);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): ListMemosRequest {
    const reader = input instanceof _m0.Reader ? input : _m0.Reader.create(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseListMemosRequest();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          if (tag !== 8) {
            break;
          }

          message.page = reader.int32();
          continue;
        case 2:
          if (tag !== 16) {
            break;
          }

          message.pageSize = reader.int32();
          continue;
        case 3:
          if (tag !== 26) {
            break;
          }

          message.filter = reader.string();
          continue;
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skipType(tag & 7);
    }
    return message;
  },

  create(base?: DeepPartial<ListMemosRequest>): ListMemosRequest {
    return ListMemosRequest.fromPartial(base ?? {});
  },

  fromPartial(object: DeepPartial<ListMemosRequest>): ListMemosRequest {
    const message = createBaseListMemosRequest();
    message.page = object.page ?? 0;
    message.pageSize = object.pageSize ?? 0;
    message.filter = object.filter ?? "";
    return message;
  },
};

function createBaseListMemosResponse(): ListMemosResponse {
  return { memos: [] };
}

export const ListMemosResponse = {
  encode(message: ListMemosResponse, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    for (const v of message.memos) {
      Memo.encode(v!, writer.uint32(10).fork()).ldelim();
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): ListMemosResponse {
    const reader = input instanceof _m0.Reader ? input : _m0.Reader.create(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseListMemosResponse();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          if (tag !== 10) {
            break;
          }

          message.memos.push(Memo.decode(reader, reader.uint32()));
          continue;
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skipType(tag & 7);
    }
    return message;
  },

  create(base?: DeepPartial<ListMemosResponse>): ListMemosResponse {
    return ListMemosResponse.fromPartial(base ?? {});
  },

  fromPartial(object: DeepPartial<ListMemosResponse>): ListMemosResponse {
    const message = createBaseListMemosResponse();
    message.memos = object.memos?.map((e) => Memo.fromPartial(e)) || [];
    return message;
  },
};

function createBaseGetMemoRequest(): GetMemoRequest {
  return { id: 0 };
}

export const GetMemoRequest = {
  encode(message: GetMemoRequest, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.id !== 0) {
      writer.uint32(8).int32(message.id);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): GetMemoRequest {
    const reader = input instanceof _m0.Reader ? input : _m0.Reader.create(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseGetMemoRequest();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          if (tag !== 8) {
            break;
          }

          message.id = reader.int32();
          continue;
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skipType(tag & 7);
    }
    return message;
  },

  create(base?: DeepPartial<GetMemoRequest>): GetMemoRequest {
    return GetMemoRequest.fromPartial(base ?? {});
  },

  fromPartial(object: DeepPartial<GetMemoRequest>): GetMemoRequest {
    const message = createBaseGetMemoRequest();
    message.id = object.id ?? 0;
    return message;
  },
};

function createBaseGetMemoResponse(): GetMemoResponse {
  return { memo: undefined };
}

export const GetMemoResponse = {
  encode(message: GetMemoResponse, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.memo !== undefined) {
      Memo.encode(message.memo, writer.uint32(10).fork()).ldelim();
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): GetMemoResponse {
    const reader = input instanceof _m0.Reader ? input : _m0.Reader.create(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseGetMemoResponse();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          if (tag !== 10) {
            break;
          }

          message.memo = Memo.decode(reader, reader.uint32());
          continue;
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skipType(tag & 7);
    }
    return message;
  },

  create(base?: DeepPartial<GetMemoResponse>): GetMemoResponse {
    return GetMemoResponse.fromPartial(base ?? {});
  },

  fromPartial(object: DeepPartial<GetMemoResponse>): GetMemoResponse {
    const message = createBaseGetMemoResponse();
    message.memo = (object.memo !== undefined && object.memo !== null) ? Memo.fromPartial(object.memo) : undefined;
    return message;
  },
};

export type MemoServiceDefinition = typeof MemoServiceDefinition;
export const MemoServiceDefinition = {
  name: "MemoService",
  fullName: "memos.api.v2.MemoService",
  methods: {
    listMemos: {
      name: "ListMemos",
      requestType: ListMemosRequest,
      requestStream: false,
      responseType: ListMemosResponse,
      responseStream: false,
      options: {
        _unknownFields: {
          578365826: [new Uint8Array([15, 18, 13, 47, 97, 112, 105, 47, 118, 50, 47, 109, 101, 109, 111, 115])],
        },
      },
    },
    getMemo: {
      name: "GetMemo",
      requestType: GetMemoRequest,
      requestStream: false,
      responseType: GetMemoResponse,
      responseStream: false,
      options: {
        _unknownFields: {
          8410: [new Uint8Array([2, 105, 100])],
          578365826: [
            new Uint8Array([
              20,
              18,
              18,
              47,
              97,
              112,
              105,
              47,
              118,
              50,
              47,
              109,
              101,
              109,
              111,
              115,
              47,
              123,
              105,
              100,
              125,
            ]),
          ],
        },
      },
    },
  },
} as const;

declare const self: any | undefined;
declare const window: any | undefined;
declare const global: any | undefined;
const tsProtoGlobalThis: any = (() => {
  if (typeof globalThis !== "undefined") {
    return globalThis;
  }
  if (typeof self !== "undefined") {
    return self;
  }
  if (typeof window !== "undefined") {
    return window;
  }
  if (typeof global !== "undefined") {
    return global;
  }
  throw "Unable to locate global object";
})();

type Builtin = Date | Function | Uint8Array | string | number | boolean | undefined;

export type DeepPartial<T> = T extends Builtin ? T
  : T extends Array<infer U> ? Array<DeepPartial<U>> : T extends ReadonlyArray<infer U> ? ReadonlyArray<DeepPartial<U>>
  : T extends {} ? { [K in keyof T]?: DeepPartial<T[K]> }
  : Partial<T>;

function longToNumber(long: Long): number {
  if (long.gt(Number.MAX_SAFE_INTEGER)) {
    throw new tsProtoGlobalThis.Error("Value is larger than Number.MAX_SAFE_INTEGER");
  }
  return long.toNumber();
}

if (_m0.util.Long !== Long) {
  _m0.util.Long = Long as any;
  _m0.configure();
}
