import { render } from "@testing-library/react";
import { UserLockIcon } from "lucide-react";
import { describe, expect, it } from "vitest";
import VisibilityIcon from "@/components/VisibilityIcon";
import { Visibility } from "@/types/proto/api/v1/memo_service_pb";
import {
  convertVisibilityFromString,
  convertVisibilityToString,
  DEFAULT_VISIBILITY_OPTIONS,
  getAssignableVisibilityOptions,
  getVisibilityOption,
  VISIBILITY_OPTIONS,
} from "@/utils/memo";

const values = (options: readonly { value: Visibility }[]) => options.map((option) => option.value);

describe("Space visibility presentation", () => {
  it("round-trips the Space audience name", () => {
    expect(convertVisibilityFromString("SPACE")).toBe(Visibility.SPACE);
    expect(convertVisibilityToString(Visibility.SPACE)).toBe("SPACE");
  });

  it("renders a distinct icon per audience", () => {
    const rendered = VISIBILITY_OPTIONS.map((option) => {
      const { container } = render(<VisibilityIcon visibility={option.value} />);
      return container.querySelector("svg")?.innerHTML;
    });

    expect(rendered.every(Boolean)).toBe(true);
    expect(new Set(rendered).size).toBe(VISIBILITY_OPTIONS.length);
  });

  it("uses user-lock for the Space audience", () => {
    expect(getVisibilityOption(Visibility.SPACE)?.icon).toBe(UserLockIcon);
  });

  it("renders nothing for an unspecified audience", () => {
    const { container } = render(<VisibilityIcon visibility={Visibility.VISIBILITY_UNSPECIFIED} />);

    expect(container.querySelector("svg")).toBeNull();
  });
});

describe("assignable visibility options", () => {
  it("withholds the Space audience when the memo has no Space placement", () => {
    expect(values(getAssignableVisibilityOptions({ hasSpacePlacement: false }))).toEqual([
      Visibility.PRIVATE,
      Visibility.PROTECTED,
      Visibility.PUBLIC,
    ]);
  });

  it("offers the Space audience when the memo is placed in a Space", () => {
    expect(values(getAssignableVisibilityOptions({ hasSpacePlacement: true }))).toEqual([
      Visibility.PRIVATE,
      Visibility.SPACE,
      Visibility.PROTECTED,
      Visibility.PUBLIC,
    ]);
  });

  it("keeps a legacy Space audience on offer when placement is unavailable, so picking cannot silently downgrade it", () => {
    expect(values(getAssignableVisibilityOptions({ hasSpacePlacement: false, current: Visibility.SPACE }))).toContain(Visibility.SPACE);
  });

  it("never offers the Space audience as a persistent default", () => {
    expect(values(DEFAULT_VISIBILITY_OPTIONS)).not.toContain(Visibility.SPACE);
  });
});
