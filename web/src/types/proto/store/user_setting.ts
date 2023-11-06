/* eslint-disable */
import _m0 from "protobufjs/minimal";

export const protobufPackage = "memos.store";

export enum UserSettingKey {
  USER_SETTING_KEY_UNSPECIFIED = 0,
  /** USER_SETTING_ACCESS_TOKENS - Access tokens for the user. */
  USER_SETTING_ACCESS_TOKENS = 1,
  UNRECOGNIZED = -1,
}

export interface UserSetting {
  userId: number;
  key: UserSettingKey;
  accessTokens?: AccessTokensUserSetting | undefined;
}

export interface AccessTokensUserSetting {
  accessTokens: AccessTokensUserSetting_AccessToken[];
}

export interface AccessTokensUserSetting_AccessToken {
  /**
   * The access token is a JWT token.
   * Including expiration time, issuer, etc.
   */
  accessToken: string;
  /** A description for the access token. */
  description: string;
}

function createBaseUserSetting(): UserSetting {
  return { userId: 0, key: 0, accessTokens: undefined };
}

export const UserSetting = {
  encode(message: UserSetting, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.userId !== 0) {
      writer.uint32(8).int32(message.userId);
    }
    if (message.key !== 0) {
      writer.uint32(16).int32(message.key);
    }
    if (message.accessTokens !== undefined) {
      AccessTokensUserSetting.encode(message.accessTokens, writer.uint32(26).fork()).ldelim();
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): UserSetting {
    const reader = input instanceof _m0.Reader ? input : _m0.Reader.create(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseUserSetting();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          if (tag !== 8) {
            break;
          }

          message.userId = reader.int32();
          continue;
        case 2:
          if (tag !== 16) {
            break;
          }

          message.key = reader.int32() as any;
          continue;
        case 3:
          if (tag !== 26) {
            break;
          }

          message.accessTokens = AccessTokensUserSetting.decode(reader, reader.uint32());
          continue;
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skipType(tag & 7);
    }
    return message;
  },

  create(base?: DeepPartial<UserSetting>): UserSetting {
    return UserSetting.fromPartial(base ?? {});
  },

  fromPartial(object: DeepPartial<UserSetting>): UserSetting {
    const message = createBaseUserSetting();
    message.userId = object.userId ?? 0;
    message.key = object.key ?? 0;
    message.accessTokens = (object.accessTokens !== undefined && object.accessTokens !== null)
      ? AccessTokensUserSetting.fromPartial(object.accessTokens)
      : undefined;
    return message;
  },
};

function createBaseAccessTokensUserSetting(): AccessTokensUserSetting {
  return { accessTokens: [] };
}

export const AccessTokensUserSetting = {
  encode(message: AccessTokensUserSetting, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    for (const v of message.accessTokens) {
      AccessTokensUserSetting_AccessToken.encode(v!, writer.uint32(10).fork()).ldelim();
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): AccessTokensUserSetting {
    const reader = input instanceof _m0.Reader ? input : _m0.Reader.create(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseAccessTokensUserSetting();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          if (tag !== 10) {
            break;
          }

          message.accessTokens.push(AccessTokensUserSetting_AccessToken.decode(reader, reader.uint32()));
          continue;
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skipType(tag & 7);
    }
    return message;
  },

  create(base?: DeepPartial<AccessTokensUserSetting>): AccessTokensUserSetting {
    return AccessTokensUserSetting.fromPartial(base ?? {});
  },

  fromPartial(object: DeepPartial<AccessTokensUserSetting>): AccessTokensUserSetting {
    const message = createBaseAccessTokensUserSetting();
    message.accessTokens = object.accessTokens?.map((e) => AccessTokensUserSetting_AccessToken.fromPartial(e)) || [];
    return message;
  },
};

function createBaseAccessTokensUserSetting_AccessToken(): AccessTokensUserSetting_AccessToken {
  return { accessToken: "", description: "" };
}

export const AccessTokensUserSetting_AccessToken = {
  encode(message: AccessTokensUserSetting_AccessToken, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.accessToken !== "") {
      writer.uint32(10).string(message.accessToken);
    }
    if (message.description !== "") {
      writer.uint32(18).string(message.description);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): AccessTokensUserSetting_AccessToken {
    const reader = input instanceof _m0.Reader ? input : _m0.Reader.create(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseAccessTokensUserSetting_AccessToken();
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
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skipType(tag & 7);
    }
    return message;
  },

  create(base?: DeepPartial<AccessTokensUserSetting_AccessToken>): AccessTokensUserSetting_AccessToken {
    return AccessTokensUserSetting_AccessToken.fromPartial(base ?? {});
  },

  fromPartial(object: DeepPartial<AccessTokensUserSetting_AccessToken>): AccessTokensUserSetting_AccessToken {
    const message = createBaseAccessTokensUserSetting_AccessToken();
    message.accessToken = object.accessToken ?? "";
    message.description = object.description ?? "";
    return message;
  },
};

type Builtin = Date | Function | Uint8Array | string | number | boolean | undefined;

export type DeepPartial<T> = T extends Builtin ? T
  : T extends Array<infer U> ? Array<DeepPartial<U>> : T extends ReadonlyArray<infer U> ? ReadonlyArray<DeepPartial<U>>
  : T extends {} ? { [K in keyof T]?: DeepPartial<T[K]> }
  : Partial<T>;
