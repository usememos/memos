import { create } from "@bufbuild/protobuf";
import { timestampFromDate } from "@bufbuild/protobuf/wkt";
import type { Timestamp } from "@bufbuild/protobuf/wkt";
import { State } from "../gen/api/v1/common_pb";
import { UserSchema, User_Role, type User } from "../gen/api/v1/user_service_pb";
import type { RowStatus, UserRow } from "../store/users";

export function buildUserName(username: string): string {
  return `users/${username}`;
}

export function usernameFromName(name: string): string {
  const match = /^users\/(.+)$/.exec(name);
  if (!match || !match[1]) {
    throw new Error(`invalid user name: ${name}`);
  }
  return match[1];
}

export function stateFromRowStatus(rowStatus: RowStatus): State {
  return rowStatus === "ARCHIVED" ? State.ARCHIVED : State.NORMAL;
}

export function rowStatusFromState(state: State): RowStatus {
  return state === State.ARCHIVED ? "ARCHIVED" : "NORMAL";
}

export function tsFromUnix(seconds: number): Timestamp {
  return timestampFromDate(new Date(seconds * 1000));
}

// Port of convertUserFromStore: email is only visible to admins and the user
// themselves; base64 data-URI avatars are served via /file/ to keep responses small.
export function convertUser(user: UserRow, viewer: UserRow | undefined): User {
  const canSeeEmail = viewer !== undefined && (viewer.role === "ADMIN" || viewer.id === user.id);
  let avatarUrl = user.avatar_url;
  if (avatarUrl.startsWith("data:")) {
    avatarUrl = `/file/${buildUserName(user.username)}/avatar`;
  }
  return create(UserSchema, {
    name: buildUserName(user.username),
    state: stateFromRowStatus(user.row_status),
    createTime: tsFromUnix(user.created_ts),
    updateTime: tsFromUnix(user.updated_ts),
    role: user.role === "ADMIN" ? User_Role.ADMIN : User_Role.USER,
    username: user.username,
    email: canSeeEmail ? user.email : "",
    displayName: user.nickname,
    avatarUrl,
    description: user.description,
  });
}
