/* eslint-disable */
import _m0 from "protobufjs/minimal";
import { FieldMask } from "../../google/protobuf/field_mask";
import { Timestamp } from "../../google/protobuf/timestamp";
import { RowStatus } from "./common";

export const protobufPackage = "memos.api.v2";

export interface User {
  /**
   * The name of the user.
   * Format: users/{username}
   */
  name: string;
  id: number;
  role: User_Role;
  email: string;
  nickname: string;
  avatarUrl: string;
  password: string;
  rowStatus: RowStatus;
  createTime?: Date | undefined;
  updateTime?: Date | undefined;
}

export enum User_Role {
  ROLE_UNSPECIFIED = 0,
  HOST = 1,
  ADMIN = 2,
  USER = 3,
  UNRECOGNIZED = -1,
}

export interface GetUserRequest {
  /**
   * The name of the user.
   * Format: users/{username}
   */
  name: string;
}

export interface GetUserResponse {
  user?: User | undefined;
}

export interface CreateUserRequest {
  user?: User | undefined;
}

export interface CreateUserResponse {
  user?: User | undefined;
}

export interface UpdateUserRequest {
  user?: User | undefined;
  updateMask?: string[] | undefined;
}

export interface UpdateUserResponse {
  user?: User | undefined;
}

export interface UserAccessToken {
  accessToken: string;
  description: string;
  issuedAt?: Date | undefined;
  expiresAt?: Date | undefined;
}

export interface ListUserAccessTokensRequest {
  /**
   * The name of the user.
   * Format: users/{username}
   */
  name: string;
}

export interface ListUserAccessTokensResponse {
  accessTokens: UserAccessToken[];
}

export interface CreateUserAccessTokenRequest {
  /**
   * The name of the user.
   * Format: users/{username}
   */
  name: string;
  description: string;
  expiresAt?: Date | undefined;
}

export interface CreateUserAccessTokenResponse {
  accessToken?: UserAccessToken | undefined;
}

export interface DeleteUserAccessTokenRequest {
  /**
   * The name of the user.
   * Format: users/{username}
   */
  name: string;
  /** access_token is the access token to delete. */
  accessToken: string;
}

export interface DeleteUserAccessTokenResponse {
}

function createBaseUser(): User {
  return {
    name: "",
    id: 0,
    role: 0,
    email: "",
    nickname: "",
    avatarUrl: "",
    password: "",
    rowStatus: 0,
    createTime: undefined,
    updateTime: undefined,
  };
}

export const User = {
  encode(message: User, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.name !== "") {
      writer.uint32(10).string(message.name);
    }
    if (message.id !== 0) {
      writer.uint32(16).int32(message.id);
    }
    if (message.role !== 0) {
      writer.uint32(24).int32(message.role);
    }
    if (message.email !== "") {
      writer.uint32(34).string(message.email);
    }
    if (message.nickname !== "") {
      writer.uint32(42).string(message.nickname);
    }
    if (message.avatarUrl !== "") {
      writer.uint32(50).string(message.avatarUrl);
    }
    if (message.password !== "") {
      writer.uint32(58).string(message.password);
    }
    if (message.rowStatus !== 0) {
      writer.uint32(64).int32(message.rowStatus);
    }
    if (message.createTime !== undefined) {
      Timestamp.encode(toTimestamp(message.createTime), writer.uint32(74).fork()).ldelim();
    }
    if (message.updateTime !== undefined) {
      Timestamp.encode(toTimestamp(message.updateTime), writer.uint32(82).fork()).ldelim();
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): User {
    const reader = input instanceof _m0.Reader ? input : _m0.Reader.create(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseUser();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          if (tag !== 10) {
            break;
          }

          message.name = reader.string();
          continue;
        case 2:
          if (tag !== 16) {
            break;
          }

          message.id = reader.int32();
          continue;
        case 3:
          if (tag !== 24) {
            break;
          }

          message.role = reader.int32() as any;
          continue;
        case 4:
          if (tag !== 34) {
            break;
          }

          message.email = reader.string();
          continue;
        case 5:
          if (tag !== 42) {
            break;
          }

          message.nickname = reader.string();
          continue;
        case 6:
          if (tag !== 50) {
            break;
          }

          message.avatarUrl = reader.string();
          continue;
        case 7:
          if (tag !== 58) {
            break;
          }

          message.password = reader.string();
          continue;
        case 8:
          if (tag !== 64) {
            break;
          }

          message.rowStatus = reader.int32() as any;
          continue;
        case 9:
          if (tag !== 74) {
            break;
          }

          message.createTime = fromTimestamp(Timestamp.decode(reader, reader.uint32()));
          continue;
        case 10:
          if (tag !== 82) {
            break;
          }

          message.updateTime = fromTimestamp(Timestamp.decode(reader, reader.uint32()));
          continue;
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skipType(tag & 7);
    }
    return message;
  },

  create(base?: DeepPartial<User>): User {
    return User.fromPartial(base ?? {});
  },

  fromPartial(object: DeepPartial<User>): User {
    const message = createBaseUser();
    message.name = object.name ?? "";
    message.id = object.id ?? 0;
    message.role = object.role ?? 0;
    message.email = object.email ?? "";
    message.nickname = object.nickname ?? "";
    message.avatarUrl = object.avatarUrl ?? "";
    message.password = object.password ?? "";
    message.rowStatus = object.rowStatus ?? 0;
    message.createTime = object.createTime ?? undefined;
    message.updateTime = object.updateTime ?? undefined;
    return message;
  },
};

function createBaseGetUserRequest(): GetUserRequest {
  return { name: "" };
}

export const GetUserRequest = {
  encode(message: GetUserRequest, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.name !== "") {
      writer.uint32(10).string(message.name);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): GetUserRequest {
    const reader = input instanceof _m0.Reader ? input : _m0.Reader.create(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseGetUserRequest();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          if (tag !== 10) {
            break;
          }

          message.name = reader.string();
          continue;
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skipType(tag & 7);
    }
    return message;
  },

  create(base?: DeepPartial<GetUserRequest>): GetUserRequest {
    return GetUserRequest.fromPartial(base ?? {});
  },

  fromPartial(object: DeepPartial<GetUserRequest>): GetUserRequest {
    const message = createBaseGetUserRequest();
    message.name = object.name ?? "";
    return message;
  },
};

function createBaseGetUserResponse(): GetUserResponse {
  return { user: undefined };
}

export const GetUserResponse = {
  encode(message: GetUserResponse, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.user !== undefined) {
      User.encode(message.user, writer.uint32(10).fork()).ldelim();
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): GetUserResponse {
    const reader = input instanceof _m0.Reader ? input : _m0.Reader.create(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseGetUserResponse();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          if (tag !== 10) {
            break;
          }

          message.user = User.decode(reader, reader.uint32());
          continue;
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skipType(tag & 7);
    }
    return message;
  },

  create(base?: DeepPartial<GetUserResponse>): GetUserResponse {
    return GetUserResponse.fromPartial(base ?? {});
  },

  fromPartial(object: DeepPartial<GetUserResponse>): GetUserResponse {
    const message = createBaseGetUserResponse();
    message.user = (object.user !== undefined && object.user !== null) ? User.fromPartial(object.user) : undefined;
    return message;
  },
};

function createBaseCreateUserRequest(): CreateUserRequest {
  return { user: undefined };
}

export const CreateUserRequest = {
  encode(message: CreateUserRequest, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.user !== undefined) {
      User.encode(message.user, writer.uint32(10).fork()).ldelim();
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): CreateUserRequest {
    const reader = input instanceof _m0.Reader ? input : _m0.Reader.create(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseCreateUserRequest();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          if (tag !== 10) {
            break;
          }

          message.user = User.decode(reader, reader.uint32());
          continue;
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skipType(tag & 7);
    }
    return message;
  },

  create(base?: DeepPartial<CreateUserRequest>): CreateUserRequest {
    return CreateUserRequest.fromPartial(base ?? {});
  },

  fromPartial(object: DeepPartial<CreateUserRequest>): CreateUserRequest {
    const message = createBaseCreateUserRequest();
    message.user = (object.user !== undefined && object.user !== null) ? User.fromPartial(object.user) : undefined;
    return message;
  },
};

function createBaseCreateUserResponse(): CreateUserResponse {
  return { user: undefined };
}

export const CreateUserResponse = {
  encode(message: CreateUserResponse, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.user !== undefined) {
      User.encode(message.user, writer.uint32(10).fork()).ldelim();
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): CreateUserResponse {
    const reader = input instanceof _m0.Reader ? input : _m0.Reader.create(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseCreateUserResponse();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          if (tag !== 10) {
            break;
          }

          message.user = User.decode(reader, reader.uint32());
          continue;
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skipType(tag & 7);
    }
    return message;
  },

  create(base?: DeepPartial<CreateUserResponse>): CreateUserResponse {
    return CreateUserResponse.fromPartial(base ?? {});
  },

  fromPartial(object: DeepPartial<CreateUserResponse>): CreateUserResponse {
    const message = createBaseCreateUserResponse();
    message.user = (object.user !== undefined && object.user !== null) ? User.fromPartial(object.user) : undefined;
    return message;
  },
};

function createBaseUpdateUserRequest(): UpdateUserRequest {
  return { user: undefined, updateMask: undefined };
}

export const UpdateUserRequest = {
  encode(message: UpdateUserRequest, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.user !== undefined) {
      User.encode(message.user, writer.uint32(10).fork()).ldelim();
    }
    if (message.updateMask !== undefined) {
      FieldMask.encode(FieldMask.wrap(message.updateMask), writer.uint32(18).fork()).ldelim();
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): UpdateUserRequest {
    const reader = input instanceof _m0.Reader ? input : _m0.Reader.create(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseUpdateUserRequest();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          if (tag !== 10) {
            break;
          }

          message.user = User.decode(reader, reader.uint32());
          continue;
        case 2:
          if (tag !== 18) {
            break;
          }

          message.updateMask = FieldMask.unwrap(FieldMask.decode(reader, reader.uint32()));
          continue;
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skipType(tag & 7);
    }
    return message;
  },

  create(base?: DeepPartial<UpdateUserRequest>): UpdateUserRequest {
    return UpdateUserRequest.fromPartial(base ?? {});
  },

  fromPartial(object: DeepPartial<UpdateUserRequest>): UpdateUserRequest {
    const message = createBaseUpdateUserRequest();
    message.user = (object.user !== undefined && object.user !== null) ? User.fromPartial(object.user) : undefined;
    message.updateMask = object.updateMask ?? undefined;
    return message;
  },
};

function createBaseUpdateUserResponse(): UpdateUserResponse {
  return { user: undefined };
}

export const UpdateUserResponse = {
  encode(message: UpdateUserResponse, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.user !== undefined) {
      User.encode(message.user, writer.uint32(10).fork()).ldelim();
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): UpdateUserResponse {
    const reader = input instanceof _m0.Reader ? input : _m0.Reader.create(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseUpdateUserResponse();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          if (tag !== 10) {
            break;
          }

          message.user = User.decode(reader, reader.uint32());
          continue;
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skipType(tag & 7);
    }
    return message;
  },

  create(base?: DeepPartial<UpdateUserResponse>): UpdateUserResponse {
    return UpdateUserResponse.fromPartial(base ?? {});
  },

  fromPartial(object: DeepPartial<UpdateUserResponse>): UpdateUserResponse {
    const message = createBaseUpdateUserResponse();
    message.user = (object.user !== undefined && object.user !== null) ? User.fromPartial(object.user) : undefined;
    return message;
  },
};

function createBaseUserAccessToken(): UserAccessToken {
  return { accessToken: "", description: "", issuedAt: undefined, expiresAt: undefined };
}

export const UserAccessToken = {
  encode(message: UserAccessToken, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.accessToken !== "") {
      writer.uint32(10).string(message.accessToken);
    }
    if (message.description !== "") {
      writer.uint32(18).string(message.description);
    }
    if (message.issuedAt !== undefined) {
      Timestamp.encode(toTimestamp(message.issuedAt), writer.uint32(26).fork()).ldelim();
    }
    if (message.expiresAt !== undefined) {
      Timestamp.encode(toTimestamp(message.expiresAt), writer.uint32(34).fork()).ldelim();
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): UserAccessToken {
    const reader = input instanceof _m0.Reader ? input : _m0.Reader.create(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseUserAccessToken();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          if (tag !== 10) {
            break;
          }

          message.accessToken = reader.string();
          continue;
        case 2:
          if (tag !== 18) {
            break;
          }

          message.description = reader.string();
          continue;
        case 3:
          if (tag !== 26) {
            break;
          }

          message.issuedAt = fromTimestamp(Timestamp.decode(reader, reader.uint32()));
          continue;
        case 4:
          if (tag !== 34) {
            break;
          }

          message.expiresAt = fromTimestamp(Timestamp.decode(reader, reader.uint32()));
          continue;
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skipType(tag & 7);
    }
    return message;
  },

  create(base?: DeepPartial<UserAccessToken>): UserAccessToken {
    return UserAccessToken.fromPartial(base ?? {});
  },

  fromPartial(object: DeepPartial<UserAccessToken>): UserAccessToken {
    const message = createBaseUserAccessToken();
    message.accessToken = object.accessToken ?? "";
    message.description = object.description ?? "";
    message.issuedAt = object.issuedAt ?? undefined;
    message.expiresAt = object.expiresAt ?? undefined;
    return message;
  },
};

function createBaseListUserAccessTokensRequest(): ListUserAccessTokensRequest {
  return { name: "" };
}

export const ListUserAccessTokensRequest = {
  encode(message: ListUserAccessTokensRequest, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.name !== "") {
      writer.uint32(10).string(message.name);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): ListUserAccessTokensRequest {
    const reader = input instanceof _m0.Reader ? input : _m0.Reader.create(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseListUserAccessTokensRequest();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          if (tag !== 10) {
            break;
          }

          message.name = reader.string();
          continue;
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skipType(tag & 7);
    }
    return message;
  },

  create(base?: DeepPartial<ListUserAccessTokensRequest>): ListUserAccessTokensRequest {
    return ListUserAccessTokensRequest.fromPartial(base ?? {});
  },

  fromPartial(object: DeepPartial<ListUserAccessTokensRequest>): ListUserAccessTokensRequest {
    const message = createBaseListUserAccessTokensRequest();
    message.name = object.name ?? "";
    return message;
  },
};

function createBaseListUserAccessTokensResponse(): ListUserAccessTokensResponse {
  return { accessTokens: [] };
}

export const ListUserAccessTokensResponse = {
  encode(message: ListUserAccessTokensResponse, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    for (const v of message.accessTokens) {
      UserAccessToken.encode(v!, writer.uint32(10).fork()).ldelim();
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): ListUserAccessTokensResponse {
    const reader = input instanceof _m0.Reader ? input : _m0.Reader.create(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseListUserAccessTokensResponse();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          if (tag !== 10) {
            break;
          }

          message.accessTokens.push(UserAccessToken.decode(reader, reader.uint32()));
          continue;
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skipType(tag & 7);
    }
    return message;
  },

  create(base?: DeepPartial<ListUserAccessTokensResponse>): ListUserAccessTokensResponse {
    return ListUserAccessTokensResponse.fromPartial(base ?? {});
  },

  fromPartial(object: DeepPartial<ListUserAccessTokensResponse>): ListUserAccessTokensResponse {
    const message = createBaseListUserAccessTokensResponse();
    message.accessTokens = object.accessTokens?.map((e) => UserAccessToken.fromPartial(e)) || [];
    return message;
  },
};

function createBaseCreateUserAccessTokenRequest(): CreateUserAccessTokenRequest {
  return { name: "", description: "", expiresAt: undefined };
}

export const CreateUserAccessTokenRequest = {
  encode(message: CreateUserAccessTokenRequest, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.name !== "") {
      writer.uint32(10).string(message.name);
    }
    if (message.description !== "") {
      writer.uint32(18).string(message.description);
    }
    if (message.expiresAt !== undefined) {
      Timestamp.encode(toTimestamp(message.expiresAt), writer.uint32(26).fork()).ldelim();
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): CreateUserAccessTokenRequest {
    const reader = input instanceof _m0.Reader ? input : _m0.Reader.create(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseCreateUserAccessTokenRequest();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          if (tag !== 10) {
            break;
          }

          message.name = reader.string();
          continue;
        case 2:
          if (tag !== 18) {
            break;
          }

          message.description = reader.string();
          continue;
        case 3:
          if (tag !== 26) {
            break;
          }

          message.expiresAt = fromTimestamp(Timestamp.decode(reader, reader.uint32()));
          continue;
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skipType(tag & 7);
    }
    return message;
  },

  create(base?: DeepPartial<CreateUserAccessTokenRequest>): CreateUserAccessTokenRequest {
    return CreateUserAccessTokenRequest.fromPartial(base ?? {});
  },

  fromPartial(object: DeepPartial<CreateUserAccessTokenRequest>): CreateUserAccessTokenRequest {
    const message = createBaseCreateUserAccessTokenRequest();
    message.name = object.name ?? "";
    message.description = object.description ?? "";
    message.expiresAt = object.expiresAt ?? undefined;
    return message;
  },
};

function createBaseCreateUserAccessTokenResponse(): CreateUserAccessTokenResponse {
  return { accessToken: undefined };
}

export const CreateUserAccessTokenResponse = {
  encode(message: CreateUserAccessTokenResponse, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.accessToken !== undefined) {
      UserAccessToken.encode(message.accessToken, writer.uint32(10).fork()).ldelim();
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): CreateUserAccessTokenResponse {
    const reader = input instanceof _m0.Reader ? input : _m0.Reader.create(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseCreateUserAccessTokenResponse();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          if (tag !== 10) {
            break;
          }

          message.accessToken = UserAccessToken.decode(reader, reader.uint32());
          continue;
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skipType(tag & 7);
    }
    return message;
  },

  create(base?: DeepPartial<CreateUserAccessTokenResponse>): CreateUserAccessTokenResponse {
    return CreateUserAccessTokenResponse.fromPartial(base ?? {});
  },

  fromPartial(object: DeepPartial<CreateUserAccessTokenResponse>): CreateUserAccessTokenResponse {
    const message = createBaseCreateUserAccessTokenResponse();
    message.accessToken = (object.accessToken !== undefined && object.accessToken !== null)
      ? UserAccessToken.fromPartial(object.accessToken)
      : undefined;
    return message;
  },
};

function createBaseDeleteUserAccessTokenRequest(): DeleteUserAccessTokenRequest {
  return { name: "", accessToken: "" };
}

export const DeleteUserAccessTokenRequest = {
  encode(message: DeleteUserAccessTokenRequest, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.name !== "") {
      writer.uint32(10).string(message.name);
    }
    if (message.accessToken !== "") {
      writer.uint32(18).string(message.accessToken);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): DeleteUserAccessTokenRequest {
    const reader = input instanceof _m0.Reader ? input : _m0.Reader.create(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseDeleteUserAccessTokenRequest();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          if (tag !== 10) {
            break;
          }

          message.name = reader.string();
          continue;
        case 2:
          if (tag !== 18) {
            break;
          }

          message.accessToken = reader.string();
          continue;
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skipType(tag & 7);
    }
    return message;
  },

  create(base?: DeepPartial<DeleteUserAccessTokenRequest>): DeleteUserAccessTokenRequest {
    return DeleteUserAccessTokenRequest.fromPartial(base ?? {});
  },

  fromPartial(object: DeepPartial<DeleteUserAccessTokenRequest>): DeleteUserAccessTokenRequest {
    const message = createBaseDeleteUserAccessTokenRequest();
    message.name = object.name ?? "";
    message.accessToken = object.accessToken ?? "";
    return message;
  },
};

function createBaseDeleteUserAccessTokenResponse(): DeleteUserAccessTokenResponse {
  return {};
}

export const DeleteUserAccessTokenResponse = {
  encode(_: DeleteUserAccessTokenResponse, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): DeleteUserAccessTokenResponse {
    const reader = input instanceof _m0.Reader ? input : _m0.Reader.create(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseDeleteUserAccessTokenResponse();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skipType(tag & 7);
    }
    return message;
  },

  create(base?: DeepPartial<DeleteUserAccessTokenResponse>): DeleteUserAccessTokenResponse {
    return DeleteUserAccessTokenResponse.fromPartial(base ?? {});
  },

  fromPartial(_: DeepPartial<DeleteUserAccessTokenResponse>): DeleteUserAccessTokenResponse {
    const message = createBaseDeleteUserAccessTokenResponse();
    return message;
  },
};

export type UserServiceDefinition = typeof UserServiceDefinition;
export const UserServiceDefinition = {
  name: "UserService",
  fullName: "memos.api.v2.UserService",
  methods: {
    getUser: {
      name: "GetUser",
      requestType: GetUserRequest,
      requestStream: false,
      responseType: GetUserResponse,
      responseStream: false,
      options: {
        _unknownFields: {
          8410: [new Uint8Array([4, 110, 97, 109, 101])],
          578365826: [
            new Uint8Array([
              24,
              18,
              22,
              47,
              97,
              112,
              105,
              47,
              118,
              50,
              47,
              123,
              110,
              97,
              109,
              101,
              61,
              117,
              115,
              101,
              114,
              115,
              47,
              42,
              125,
            ]),
          ],
        },
      },
    },
    createUser: {
      name: "CreateUser",
      requestType: CreateUserRequest,
      requestStream: false,
      responseType: CreateUserResponse,
      responseStream: false,
      options: {
        _unknownFields: {
          8410: [new Uint8Array([4, 117, 115, 101, 114])],
          578365826: [new Uint8Array([17, 58, 4, 117, 115, 101, 114, 34, 9, 47, 118, 49, 47, 117, 115, 101, 114, 115])],
        },
      },
    },
    updateUser: {
      name: "UpdateUser",
      requestType: UpdateUserRequest,
      requestStream: false,
      responseType: UpdateUserResponse,
      responseStream: false,
      options: {
        _unknownFields: {
          8410: [new Uint8Array([16, 117, 115, 101, 114, 44, 117, 112, 100, 97, 116, 101, 95, 109, 97, 115, 107])],
          578365826: [
            new Uint8Array([
              35,
              58,
              4,
              117,
              115,
              101,
              114,
              50,
              27,
              47,
              97,
              112,
              105,
              47,
              118,
              50,
              47,
              123,
              117,
              115,
              101,
              114,
              46,
              110,
              97,
              109,
              101,
              61,
              117,
              115,
              101,
              114,
              115,
              47,
              42,
              125,
            ]),
          ],
        },
      },
    },
    /** ListUserAccessTokens returns a list of access tokens for a user. */
    listUserAccessTokens: {
      name: "ListUserAccessTokens",
      requestType: ListUserAccessTokensRequest,
      requestStream: false,
      responseType: ListUserAccessTokensResponse,
      responseStream: false,
      options: {
        _unknownFields: {
          8410: [new Uint8Array([4, 110, 97, 109, 101])],
          578365826: [
            new Uint8Array([
              38,
              18,
              36,
              47,
              97,
              112,
              105,
              47,
              118,
              50,
              47,
              123,
              110,
              97,
              109,
              101,
              61,
              117,
              115,
              101,
              114,
              115,
              47,
              42,
              125,
              47,
              97,
              99,
              99,
              101,
              115,
              115,
              95,
              116,
              111,
              107,
              101,
              110,
              115,
            ]),
          ],
        },
      },
    },
    /** CreateUserAccessToken creates a new access token for a user. */
    createUserAccessToken: {
      name: "CreateUserAccessToken",
      requestType: CreateUserAccessTokenRequest,
      requestStream: false,
      responseType: CreateUserAccessTokenResponse,
      responseStream: false,
      options: {
        _unknownFields: {
          8410: [new Uint8Array([4, 110, 97, 109, 101])],
          578365826: [
            new Uint8Array([
              41,
              58,
              1,
              42,
              34,
              36,
              47,
              97,
              112,
              105,
              47,
              118,
              50,
              47,
              123,
              110,
              97,
              109,
              101,
              61,
              117,
              115,
              101,
              114,
              115,
              47,
              42,
              125,
              47,
              97,
              99,
              99,
              101,
              115,
              115,
              95,
              116,
              111,
              107,
              101,
              110,
              115,
            ]),
          ],
        },
      },
    },
    /** DeleteUserAccessToken deletes an access token for a user. */
    deleteUserAccessToken: {
      name: "DeleteUserAccessToken",
      requestType: DeleteUserAccessTokenRequest,
      requestStream: false,
      responseType: DeleteUserAccessTokenResponse,
      responseStream: false,
      options: {
        _unknownFields: {
          8410: [new Uint8Array([17, 110, 97, 109, 101, 44, 97, 99, 99, 101, 115, 115, 95, 116, 111, 107, 101, 110])],
          578365826: [
            new Uint8Array([
              53,
              42,
              51,
              47,
              97,
              112,
              105,
              47,
              118,
              50,
              47,
              123,
              110,
              97,
              109,
              101,
              61,
              117,
              115,
              101,
              114,
              115,
              47,
              42,
              125,
              47,
              97,
              99,
              99,
              101,
              115,
              115,
              95,
              116,
              111,
              107,
              101,
              110,
              115,
              47,
              123,
              97,
              99,
              99,
              101,
              115,
              115,
              95,
              116,
              111,
              107,
              101,
              110,
              125,
            ]),
          ],
        },
      },
    },
  },
} as const;

type Builtin = Date | Function | Uint8Array | string | number | boolean | undefined;

export type DeepPartial<T> = T extends Builtin ? T
  : T extends Array<infer U> ? Array<DeepPartial<U>> : T extends ReadonlyArray<infer U> ? ReadonlyArray<DeepPartial<U>>
  : T extends {} ? { [K in keyof T]?: DeepPartial<T[K]> }
  : Partial<T>;

function toTimestamp(date: Date): Timestamp {
  const seconds = date.getTime() / 1_000;
  const nanos = (date.getTime() % 1_000) * 1_000_000;
  return { seconds, nanos };
}

function fromTimestamp(t: Timestamp): Date {
  let millis = (t.seconds || 0) * 1_000;
  millis += (t.nanos || 0) / 1_000_000;
  return new Date(millis);
}
