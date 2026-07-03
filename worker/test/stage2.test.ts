import { describe, expect, it } from "vitest";
import { Code, ConnectError } from "@connectrpc/connect";
import { AuthService } from "../src/gen/api/v1/auth_service_pb";
import { InstanceService } from "../src/gen/api/v1/instance_service_pb";
import { UserService } from "../src/gen/api/v1/user_service_pb";
import { User_Role } from "../src/gen/api/v1/user_service_pb";
import { makeClient } from "./helpers";

// env.ADMIN_EMAILS is "" in wrangler.jsonc vars; override per-test via helper env.
const ADMIN_EMAIL = "admin@example.com";
const USER_EMAIL = "someone@example.com";

// Note: makeClient uses DEV_USER_EMAIL fallback; ADMIN_EMAILS stays empty, so
// everyone lands as USER unless we patch env. Patch it here once.
import { env } from "cloudflare:test";
(env as { ADMIN_EMAILS: string }).ADMIN_EMAILS = ADMIN_EMAIL;

describe("auth + user provisioning", () => {
  it("auto-provisions on first request and returns current user", async () => {
    const client = makeClient(AuthService, ADMIN_EMAIL);
    const { user } = await client.getCurrentUser({});
    expect(user?.username).toBe("admin");
    expect(user?.role).toBe(User_Role.ADMIN);
    expect(user?.email).toBe(ADMIN_EMAIL);

    // Second call reuses the same row.
    const again = await client.getCurrentUser({});
    expect(again.user?.name).toBe(user?.name);
  });

  it("provisions plain users with USER role and unique usernames", async () => {
    const client = makeClient(AuthService, USER_EMAIL);
    const { user } = await client.getCurrentUser({});
    expect(user?.role).toBe(User_Role.USER);
    expect(user?.username).toBe("someone");
  });

  it("rejects anonymous GetCurrentUser", async () => {
    const client = makeClient(AuthService, "");
    await expect(client.getCurrentUser({})).rejects.toMatchObject({ code: Code.Unauthenticated });
  });

  it("declines SignIn (handled by Access)", async () => {
    const client = makeClient(AuthService, "");
    const err = await client.signIn({}).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ConnectError);
    expect((err as ConnectError).code).toBe(Code.Unimplemented);
  });
});

describe("UserService", () => {
  it("updates own display name via field mask", async () => {
    const client = makeClient(UserService, USER_EMAIL);
    await makeClient(AuthService, USER_EMAIL).getCurrentUser({});
    const updated = await client.updateUser({
      user: { name: "users/someone", displayName: "Кто-то" },
      updateMask: { paths: ["display_name"] },
    });
    expect(updated.displayName).toBe("Кто-то");
  });

  it("forbids updating another user unless admin", async () => {
    await makeClient(AuthService, ADMIN_EMAIL).getCurrentUser({});
    await makeClient(AuthService, USER_EMAIL).getCurrentUser({});

    const userClient = makeClient(UserService, USER_EMAIL);
    await expect(
      userClient.updateUser({
        user: { name: "users/admin", displayName: "hax" },
        updateMask: { paths: ["display_name"] },
      }),
    ).rejects.toMatchObject({ code: Code.PermissionDenied });

    const adminClient = makeClient(UserService, ADMIN_EMAIL);
    const updated = await adminClient.updateUser({
      user: { name: "users/someone", displayName: "renamed" },
      updateMask: { paths: ["display_name"] },
    });
    expect(updated.displayName).toBe("renamed");
  });

  it("hides emails from other users", async () => {
    await makeClient(AuthService, ADMIN_EMAIL).getCurrentUser({});
    await makeClient(AuthService, USER_EMAIL).getCurrentUser({});
    const client = makeClient(UserService, USER_EMAIL);
    const admin = await client.getUser({ name: "users/admin" });
    expect(admin.email).toBe("");
    const self = await client.getUser({ name: "users/someone" });
    expect(self.email).toBe(USER_EMAIL);
  });

  it("stores and merges user settings", async () => {
    await makeClient(AuthService, USER_EMAIL).getCurrentUser({});
    const client = makeClient(UserService, USER_EMAIL);

    const initial = await client.getUserSetting({ name: "users/someone/settings/general" });
    expect(initial.value.case).toBe("generalSetting");

    await client.updateUserSetting({
      setting: {
        name: "users/someone/settings/general",
        value: { case: "generalSetting", value: { locale: "ru", memoVisibility: "", theme: "" } },
      },
      updateMask: { paths: ["locale"] },
    });
    const after = await client.getUserSetting({ name: "users/someone/settings/general" });
    expect(after.value.case === "generalSetting" && after.value.value.locale).toBe("ru");
    // memo_visibility untouched by the mask: default PRIVATE preserved.
    expect(after.value.case === "generalSetting" && after.value.value.memoVisibility).toBe("PRIVATE");
  });

  it("deletes a user cascade without touching others", async () => {
    await makeClient(AuthService, ADMIN_EMAIL).getCurrentUser({});
    await makeClient(AuthService, USER_EMAIL).getCurrentUser({});
    const adminClient = makeClient(UserService, ADMIN_EMAIL);
    await adminClient.deleteUser({ name: "users/someone" });
    await expect(adminClient.getUser({ name: "users/someone" })).rejects.toMatchObject({ code: Code.NotFound });
    const self = await adminClient.getUser({ name: "users/admin" });
    expect(self.username).toBe("admin");
  });
});

describe("InstanceService", () => {
  it("returns instance profile with admin", async () => {
    await makeClient(AuthService, ADMIN_EMAIL).getCurrentUser({});
    const client = makeClient(InstanceService, "");
    const profile = await client.getInstanceProfile({});
    expect(profile.needsSetup).toBe(false);
    expect(profile.admin?.username).toBe("admin");
  });

  it("round-trips instance settings, admin-only for update", async () => {
    await makeClient(AuthService, ADMIN_EMAIL).getCurrentUser({});
    await makeClient(AuthService, USER_EMAIL).getCurrentUser({});

    const userClient = makeClient(InstanceService, USER_EMAIL);
    await expect(
      userClient.updateInstanceSetting({
        setting: {
          name: "instance/settings/GENERAL",
          value: { case: "generalSetting", value: { additionalScript: "x" } },
        },
      }),
    ).rejects.toMatchObject({ code: Code.PermissionDenied });

    const adminClient = makeClient(InstanceService, ADMIN_EMAIL);
    await adminClient.updateInstanceSetting({
      setting: {
        name: "instance/settings/GENERAL",
        value: { case: "generalSetting", value: { additionalScript: "x" } },
      },
    });
    const roundTripped = await userClient.getInstanceSetting({ name: "instance/settings/GENERAL" });
    expect(roundTripped.value.case === "generalSetting" && roundTripped.value.value.additionalScript).toBe("x");
  });

  it("fills in MEMO_RELATED defaults (reactions, content limit) even when unset", async () => {
    await makeClient(AuthService, USER_EMAIL).getCurrentUser({});
    const client = makeClient(InstanceService, USER_EMAIL);

    const single = await client.getInstanceSetting({ name: "instance/settings/MEMO_RELATED" });
    expect(single.value.case === "memoRelatedSetting" && single.value.value.reactions).toEqual([
      "👍",
      "👎",
      "❤️",
      "🎉",
      "😄",
      "😕",
      "😢",
      "😡",
    ]);
    expect(single.value.case === "memoRelatedSetting" && single.value.value.contentLengthLimit).toBe(8192);
  });

  it("batchGetInstanceSettings honors request.names, including unset settings", async () => {
    await makeClient(AuthService, USER_EMAIL).getCurrentUser({});
    const client = makeClient(InstanceService, USER_EMAIL);

    const response = await client.batchGetInstanceSettings({
      names: ["instance/settings/GENERAL", "instance/settings/MEMO_RELATED"],
    });
    expect(response.settings.map((s) => s.name)).toEqual(["instance/settings/GENERAL", "instance/settings/MEMO_RELATED"]);
    const memoRelated = response.settings[1];
    expect(memoRelated?.value.case === "memoRelatedSetting" && memoRelated.value.value.reactions.length).toBe(8);
  });

  it("batchGetInstanceSettings rejects admin-only settings for non-admins", async () => {
    await makeClient(AuthService, USER_EMAIL).getCurrentUser({});
    const client = makeClient(InstanceService, USER_EMAIL);
    await expect(client.batchGetInstanceSettings({ names: ["instance/settings/STORAGE"] })).rejects.toMatchObject({
      code: Code.PermissionDenied,
    });
  });
});
