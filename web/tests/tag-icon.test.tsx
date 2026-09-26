import { create } from "@bufbuild/protobuf";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import TagsSection from "@/components/AppSidebar/TagsSection";
import { MemoFilterProvider } from "@/contexts/MemoFilterContext";
import { configuredTagIcon, resolveTagIcon } from "@/lib/tag";
import {
  UserSetting_TagMetadata_IconSchema,
  UserSetting_TagMetadataSchema,
  UserSetting_TagsSettingSchema,
} from "@/types/proto/api/v1/user_service_pb";

vi.mock("@/utils/i18n", () => ({ useTranslate: () => (key: string) => key }));

const emoji = (value: string) => create(UserSetting_TagMetadata_IconSchema, { value: { case: "emoji", value } });
const tagsSetting = (tags: Record<string, { icon?: string; lucide?: string }>) =>
  create(UserSetting_TagsSettingSchema, {
    tags: Object.fromEntries(
      Object.entries(tags).map(([tag, { icon, lucide }]) => [
        tag,
        create(UserSetting_TagMetadataSchema, {
          icon: icon ? { value: { case: "emoji", value: icon } } : lucide ? { value: { case: "lucide", value: lucide } } : undefined,
        }),
      ]),
    ),
  });

const renderSection = (props: Partial<Parameters<typeof TagsSection>[0]> = {}) =>
  render(
    <MemoryRouter>
      <MemoFilterProvider>
        <TagsSection tagCount={{ 读书: 2 }} scope="home" {...props} />
      </MemoFilterProvider>
    </MemoryRouter>,
  );

describe("tag icons", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("prefers a configured icon, then a leading emoji in the name, then nothing", () => {
    const setting = tagsSetting({ 读书: { icon: "🔥" } });

    expect(resolveTagIcon("读书", setting)).toEqual(emoji("🔥"));
    // The name keeps its own emoji until the tag is given one of its own.
    expect(resolveTagIcon("📗笔记", setting)).toEqual({ value: { case: "emoji", value: "📗" } });
    expect(resolveTagIcon("笔记", setting)).toBeUndefined();
    expect(resolveTagIcon("读书", undefined)).toBeUndefined();
  });

  it("resolves icons through the anchored regex rules tag metadata already uses", () => {
    const setting = tagsSetting({ "project/.*": { lucide: "rocket" } });

    expect(configuredTagIcon("project/memos", setting)).toEqual(
      create(UserSetting_TagMetadata_IconSchema, { value: { case: "lucide", value: "rocket" } }),
    );
    expect(configuredTagIcon("projects", setting)).toBeUndefined();
    // An icon-less rule must not shadow the fallbacks.
    expect(configuredTagIcon("读书", tagsSetting({ 读书: {} }))).toBeUndefined();
  });

  it("picks a tag's icon from its mark in the sidebar", async () => {
    const onTagIconChange = vi.fn();
    renderSection({ tagIcon: () => undefined, onTagIconChange });

    fireEvent.click(screen.getByRole("button", { name: "setting.tags.set-icon" }));
    fireEvent.click(await screen.findByRole("tab", { name: "space.icon.emoji" }));
    const search = screen.getByRole("textbox", { name: "space.icon.search-emoji" });
    fireEvent.change(search, { target: { value: "📗" } });
    fireEvent.keyDown(search, { key: "Enter" });

    expect(onTagIconChange).toHaveBeenCalledWith("读书", emoji("📗"));
  });

  it("shows the resolved mark and stays read-only for tags nobody owns", () => {
    renderSection({ tagIcon: () => emoji("🔥") });

    expect(screen.getByText("🔥")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "setting.tags.set-icon" })).not.toBeInTheDocument();
  });

  it("marks tree rows by full path, so a nested tag is not styled by its parent's name", () => {
    localStorage.setItem("tag-view-as-tree", "true");
    localStorage.setItem("tag-tree-expanded:home", JSON.stringify({ expanded: ["📗读书"] }));
    renderSection({
      tagCount: { "📗读书": 2, "📗读书/笔记": 1 },
      tagIcon: (tag) => (tag === "📗读书/笔记" ? emoji("🔥") : undefined),
    });

    expect(screen.getByText("🔥")).toBeInTheDocument();
    // The parent segment keeps the emoji written into its own name.
    expect(screen.getByText("📗")).toBeInTheDocument();
  });
});
