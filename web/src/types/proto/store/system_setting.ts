/* eslint-disable */
import _m0 from "protobufjs/minimal";

export const protobufPackage = "memos.store";

export enum SystemSettingKey {
  SYSTEM_SETTING_KEY_UNSPECIFIED = 0,
  /** BACKUP_CONFIG - BackupConfig is the key for auto-backup configuration. */
  BACKUP_CONFIG = 1,
  UNRECOGNIZED = -1,
}

export interface BackupConfig {
  /** enabled indicates whether backup is enabled. */
  enabled: boolean;
  /** cron is the cron expression for backup. See https://godoc.org/github.com/robfig/cron#hdr-CRON_Expression_Format */
  cron: string;
  /** max_keep is the maximum number of backups to keep. */
  maxKeep: number;
}

function createBaseBackupConfig(): BackupConfig {
  return { enabled: false, cron: "", maxKeep: 0 };
}

export const BackupConfig = {
  encode(message: BackupConfig, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.enabled === true) {
      writer.uint32(8).bool(message.enabled);
    }
    if (message.cron !== "") {
      writer.uint32(18).string(message.cron);
    }
    if (message.maxKeep !== 0) {
      writer.uint32(24).int32(message.maxKeep);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): BackupConfig {
    const reader = input instanceof _m0.Reader ? input : _m0.Reader.create(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseBackupConfig();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          if (tag !== 8) {
            break;
          }

          message.enabled = reader.bool();
          continue;
        case 2:
          if (tag !== 18) {
            break;
          }

          message.cron = reader.string();
          continue;
        case 3:
          if (tag !== 24) {
            break;
          }

          message.maxKeep = reader.int32();
          continue;
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skipType(tag & 7);
    }
    return message;
  },

  create(base?: DeepPartial<BackupConfig>): BackupConfig {
    return BackupConfig.fromPartial(base ?? {});
  },

  fromPartial(object: DeepPartial<BackupConfig>): BackupConfig {
    const message = createBaseBackupConfig();
    message.enabled = object.enabled ?? false;
    message.cron = object.cron ?? "";
    message.maxKeep = object.maxKeep ?? 0;
    return message;
  },
};

type Builtin = Date | Function | Uint8Array | string | number | boolean | undefined;

export type DeepPartial<T> = T extends Builtin ? T
  : T extends Array<infer U> ? Array<DeepPartial<U>> : T extends ReadonlyArray<infer U> ? ReadonlyArray<DeepPartial<U>>
  : T extends {} ? { [K in keyof T]?: DeepPartial<T[K]> }
  : Partial<T>;
