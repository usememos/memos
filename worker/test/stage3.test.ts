import { describe, expect, it } from "vitest";
import { env } from "cloudflare:test";
import { Code } from "@connectrpc/connect";
import { AuthService } from "../src/gen/api/v1/auth_service_pb";
import { MemoService, Visibility } from "../src/gen/api/v1/memo_service_pb";
import { ShortcutService } from "../src/gen/api/v1/shortcut_service_pb";
import { UserService } from "../src/gen/api/v1/user_service_pb";
import { makeClient } from "./helpers";

const ALICE = "alice@example.com";
const BOB = "bob@example.com";

(env as { ADMIN_EMAILS: string }).ADMIN_EMAILS = "";

async function provision(email: string): Promise<void> {
  await makeClient(AuthService, email).getCurrentUser({});
}

describe("MemoService", () => {
  it("creates a memo with payload extraction and reads it back", async () => {
    await provision(ALICE);
    const client = makeClient(MemoService, ALICE);
    const memo = await client.createMemo({
      memo: {
        content: "Привет #работа/проект\n\n- [ ] сделать\n\nhttps://example.com [x](https://x.dev)",
        visibility: Visibility.PRIVATE,
      },
    });
    expect(memo.name).toMatch(/^memos\//);
    expect(memo.tags).toEqual(["работа/проект"]);
    expect(memo.property?.hasTaskList).toBe(true);
    expect(memo.property?.hasIncompleteTasks).toBe(true);
    expect(memo.property?.hasLink).toBe(true);
    expect(memo.creator).toBe("users/alice");

    const fetched = await client.getMemo({ name: memo.name });
    expect(fetched.content).toContain("Привет");
    expect(fetched.snippet).toContain("Привет");
  });

  it("enforces visibility between users", async () => {
    await provision(ALICE);
    await provision(BOB);
    const alice = makeClient(MemoService, ALICE);
    const bob = makeClient(MemoService, BOB);
    const anonymous = makeClient(MemoService, "");

    const privateMemo = await alice.createMemo({ memo: { content: "секрет", visibility: Visibility.PRIVATE } });
    const protectedMemo = await alice.createMemo({ memo: { content: "для своих", visibility: Visibility.PROTECTED } });
    const publicMemo = await alice.createMemo({ memo: { content: "всем", visibility: Visibility.PUBLIC } });

    await expect(bob.getMemo({ name: privateMemo.name })).rejects.toMatchObject({ code: Code.PermissionDenied });
    await expect(bob.getMemo({ name: protectedMemo.name })).resolves.toBeDefined();
    await expect(anonymous.getMemo({ name: protectedMemo.name })).rejects.toMatchObject({ code: Code.Unauthenticated });
    await expect(anonymous.getMemo({ name: publicMemo.name })).resolves.toBeDefined();

    const bobList = await bob.listMemos({});
    const names = bobList.memos.map((m) => m.name);
    expect(names).toContain(publicMemo.name);
    expect(names).toContain(protectedMemo.name);
    expect(names).not.toContain(privateMemo.name);

    const anonymousList = await anonymous.listMemos({});
    expect(anonymousList.memos.map((m) => m.name)).toEqual([publicMemo.name]);
  });

  it("filters by tag, content and pinned", async () => {
    await provision(ALICE);
    const client = makeClient(MemoService, ALICE);
    await client.createMemo({ memo: { content: "заметка про #работа", visibility: Visibility.PRIVATE } });
    await client.createMemo({ memo: { content: "заметка про #дом", visibility: Visibility.PRIVATE } });
    const pinnedMemo = await client.createMemo({ memo: { content: "важное #работа/срочно", visibility: Visibility.PRIVATE } });
    await client.updateMemo({ memo: { name: pinnedMemo.name, pinned: true }, updateMask: { paths: ["pinned"] } });

    const byTag = await client.listMemos({ filter: 'tag in ["работа"]' });
    expect(byTag.memos).toHaveLength(2); // hierarchical: работа + работа/срочно

    const byContent = await client.listMemos({ filter: 'content.contains("дом")' });
    expect(byContent.memos).toHaveLength(1);

    const byPinned = await client.listMemos({ filter: "pinned" });
    expect(byPinned.memos.map((m) => m.name)).toEqual([pinnedMemo.name]);

    await expect(client.listMemos({ filter: "bogus == 1" })).rejects.toMatchObject({ code: Code.InvalidArgument });
  });

  it("paginates with page tokens", async () => {
    await provision(ALICE);
    const client = makeClient(MemoService, ALICE);
    for (let i = 0; i < 5; i++) {
      await client.createMemo({ memo: { content: `memo ${i}`, visibility: Visibility.PRIVATE } });
    }
    const page1 = await client.listMemos({ pageSize: 2 });
    expect(page1.memos).toHaveLength(2);
    expect(page1.nextPageToken).not.toBe("");
    const page2 = await client.listMemos({ pageToken: page1.nextPageToken });
    expect(page2.memos).toHaveLength(2);
    const page3 = await client.listMemos({ pageToken: page2.nextPageToken });
    expect(page3.memos).toHaveLength(1);
    expect(page3.nextPageToken).toBe("");
    const allNames = [...page1.memos, ...page2.memos, ...page3.memos].map((m) => m.name);
    expect(new Set(allNames).size).toBe(5);
  });

  it("supports comments with parent linkage", async () => {
    await provision(ALICE);
    await provision(BOB);
    const alice = makeClient(MemoService, ALICE);
    const bob = makeClient(MemoService, BOB);

    const memo = await alice.createMemo({ memo: { content: "пост", visibility: Visibility.PROTECTED } });
    const comment = await bob.createMemoComment({
      name: memo.name,
      comment: { content: "коммент", visibility: Visibility.PROTECTED },
    });
    expect(comment.parent).toBe(memo.name);

    const comments = await alice.listMemoComments({ name: memo.name });
    expect(comments.memos).toHaveLength(1);
    expect(comments.memos[0]!.content).toBe("коммент");

    // Comments are excluded from the main list.
    const list = await bob.listMemos({});
    expect(list.memos.map((m) => m.name)).not.toContain(comment.name);
  });

  it("handles reactions", async () => {
    await provision(ALICE);
    await provision(BOB);
    const alice = makeClient(MemoService, ALICE);
    const bob = makeClient(MemoService, BOB);
    const memo = await alice.createMemo({ memo: { content: "пост", visibility: Visibility.PUBLIC } });

    await bob.upsertMemoReaction({ name: memo.name, reaction: { reactionType: "👍" } });
    const reactions = await alice.listMemoReactions({ name: memo.name });
    expect(reactions.reactions).toHaveLength(1);
    expect(reactions.reactions[0]!.reactionType).toBe("👍");
    expect(reactions.reactions[0]!.creator).toBe("users/bob");

    await expect(alice.deleteMemoReaction({ name: reactions.reactions[0]!.name })).rejects.toMatchObject({
      code: Code.PermissionDenied,
    });
    await bob.deleteMemoReaction({ name: reactions.reactions[0]!.name });
    const after = await alice.listMemoReactions({ name: memo.name });
    expect(after.reactions).toHaveLength(0);
  });

  it("shares memos via tokens that bypass visibility", async () => {
    await provision(ALICE);
    const alice = makeClient(MemoService, ALICE);
    const anonymous = makeClient(MemoService, "");
    const memo = await alice.createMemo({ memo: { content: "секрет", visibility: Visibility.PRIVATE } });

    const share = await alice.createMemoShare({ parent: memo.name, memoShare: {} });
    const shareId = share.name.split("/shares/")[1]!;
    const viaShare = await anonymous.getMemoByShare({ shareId });
    expect(viaShare.content).toBe("секрет");

    await alice.deleteMemoShare({ name: share.name });
    await expect(anonymous.getMemoByShare({ shareId })).rejects.toMatchObject({ code: Code.NotFound });
  });

  it("deletes a memo together with its comment tree", async () => {
    await provision(ALICE);
    const alice = makeClient(MemoService, ALICE);
    const memo = await alice.createMemo({ memo: { content: "root", visibility: Visibility.PUBLIC } });
    const comment = await alice.createMemoComment({ name: memo.name, comment: { content: "c1", visibility: Visibility.PUBLIC } });
    await alice.deleteMemo({ name: memo.name });
    await expect(alice.getMemo({ name: memo.name })).rejects.toMatchObject({ code: Code.NotFound });
    await expect(alice.getMemo({ name: comment.name })).rejects.toMatchObject({ code: Code.NotFound });
  });

  it("archives and restores via state update", async () => {
    await provision(ALICE);
    const alice = makeClient(MemoService, ALICE);
    const memo = await alice.createMemo({ memo: { content: "archive me", visibility: Visibility.PRIVATE } });
    await alice.updateMemo({ memo: { name: memo.name, state: 2 }, updateMask: { paths: ["state"] } });
    const normal = await alice.listMemos({});
    expect(normal.memos.map((m) => m.name)).not.toContain(memo.name);
    const archived = await alice.listMemos({ state: 2 });
    expect(archived.memos.map((m) => m.name)).toContain(memo.name);
  });
});

describe("ShortcutService", () => {
  it("CRUDs shortcuts with filter validation", async () => {
    await provision(ALICE);
    const client = makeClient(ShortcutService, ALICE);

    await expect(
      client.createShortcut({ parent: "users/alice", shortcut: { title: "bad", filter: "nope ==" } }),
    ).rejects.toMatchObject({ code: Code.InvalidArgument });

    const shortcut = await client.createShortcut({
      parent: "users/alice",
      shortcut: { title: "Работа", filter: 'tag in ["работа"]' },
    });
    expect(shortcut.name).toContain("users/alice/shortcuts/");

    const updated = await client.updateShortcut({
      shortcut: { name: shortcut.name, title: "Работа 2", filter: shortcut.filter },
      updateMask: { paths: ["title"] },
    });
    expect(updated.title).toBe("Работа 2");

    const list = await client.listShortcuts({ parent: "users/alice" });
    expect(list.shortcuts).toHaveLength(1);

    await client.deleteShortcut({ name: shortcut.name });
    const after = await client.listShortcuts({ parent: "users/alice" });
    expect(after.shortcuts).toHaveLength(0);
  });
});

describe("user stats", () => {
  it("aggregates tags and memo types per user", async () => {
    await provision(ALICE);
    const memoClient = makeClient(MemoService, ALICE);
    await memoClient.createMemo({ memo: { content: "#a #b `code`", visibility: Visibility.PRIVATE } });
    await memoClient.createMemo({ memo: { content: "#a\n- [ ] t", visibility: Visibility.PUBLIC } });

    const userClient = makeClient(UserService, ALICE);
    const stats = await userClient.getUserStats({ name: "users/alice" });
    expect(stats.totalMemoCount).toBe(2);
    expect(stats.tagCount["a"]).toBe(2);
    expect(stats.tagCount["b"]).toBe(1);
    expect(stats.memoTypeStats?.codeCount).toBe(1);
    expect(stats.memoTypeStats?.undoCount).toBe(1);

    // Anonymous users only see stats from public memos.
    const anonymousStats = await makeClient(UserService, "").listAllUserStats({});
    expect(anonymousStats.stats).toHaveLength(1);
    expect(anonymousStats.stats[0]!.totalMemoCount).toBe(1);
  });
});
