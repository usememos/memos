import { create } from "@bufbuild/protobuf";
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAutoFocusMode } from "@/hooks/useAutoFocusMode";
import { useSourceMode } from "@/hooks/useSourceMode";
import { type UserSetting_EditorSetting, UserSetting_EditorSettingSchema } from "@/types/proto/api/user_service_pb";

const mocks = vi.hoisted(() => ({ mutate: vi.fn(), error: vi.fn() }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => auth }));
vi.mock("@/hooks/useUserQueries", () => ({ useUpdateUserEditorSetting: () => ({ mutate: mocks.mutate }) }));
vi.mock("@/lib/error", () => ({ handleError: mocks.error }));

let setting: UserSetting_EditorSetting | undefined;
const auth = {
  currentUser: { name: "users/test" },
  get userEditorSetting() {
    return setting;
  },
  setUserEditorSetting: (
    update:
      | UserSetting_EditorSetting
      | undefined
      | ((current: UserSetting_EditorSetting | undefined) => UserSetting_EditorSetting | undefined),
  ) => {
    setting = typeof update === "function" ? update(setting) : update;
  },
};

beforeEach(() => {
  setting = undefined;
  vi.clearAllMocks();
});

describe("editor preferences", () => {
  it("defaults to rich text and focus mode disabled", () => {
    const { result } = renderHook(() => [useSourceMode(), useAutoFocusMode()] as const);
    expect(result.current[0][0]).toBe("rich");
    expect(result.current[1][0]).toBe(false);
  });

  it("updates each preference independently and masks only its field", () => {
    setting = create(UserSetting_EditorSettingSchema, { sourceMode: true });
    const { result, rerender } = renderHook(() => [useSourceMode(), useAutoFocusMode()] as const);
    act(() => result.current[1][1](true));
    expect(setting).toMatchObject({ sourceMode: true, autoFocusMode: true });
    expect(mocks.mutate.mock.calls[0][0]).toMatchObject({ editorSetting: { autoFocusMode: true }, updateMask: ["auto_focus_mode"] });
    rerender();
    act(() => result.current[0][1]("rich"));
    expect(setting).toMatchObject({ sourceMode: false, autoFocusMode: true });
    expect(mocks.mutate.mock.calls[1][0]).toMatchObject({ editorSetting: { sourceMode: false }, updateMask: ["source_mode"] });
  });

  it("rolls back only the failed preference after another preference changes", () => {
    const { result, rerender } = renderHook(() => [useSourceMode(), useAutoFocusMode()] as const);
    act(() => result.current[1][1](true));
    rerender();
    act(() => result.current[0][1]("source"));
    const error = new Error("save failed");
    act(() => mocks.mutate.mock.calls[0][1].onError(error));
    expect(setting).toMatchObject({ sourceMode: true, autoFocusMode: false });
    expect(mocks.error).toHaveBeenCalledWith(error, expect.any(Function));
  });
});
