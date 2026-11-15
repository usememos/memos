import { fireEvent, render, screen, within } from "@testing-library/react";
import { Input, Switch } from "@usememos/ui";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import SettingGroup from "@/components/Settings/SettingGroup";
import { SettingList, SettingListItem } from "@/components/Settings/SettingList";

describe("setting rows", () => {
  it("associates a list, input and description with their visible labels", () => {
    render(
      <SettingGroup title="Storage">
        <SettingList>
          <SettingListItem label="Bucket" description="The bucket used for uploads.">
            <Input defaultValue="memos" />
          </SettingListItem>
          <SettingListItem label="File path" description="The path for new uploads." orientation="vertical">
            <Input defaultValue="uploads/{filename}" />
          </SettingListItem>
        </SettingList>
      </SettingGroup>,
    );

    const list = screen.getByRole("list", { name: "Storage" });
    expect(within(list).getAllByRole("listitem")).toHaveLength(2);
    expect(within(list).getByRole("textbox", { name: "Bucket" })).toHaveAccessibleDescription("The bucket used for uploads.");
    expect(within(list).getByRole("textbox", { name: "File path" })).toHaveAccessibleDescription("The path for new uploads.");
  });

  it("toggles a setting through its label", () => {
    const changed = vi.fn();
    const Harness = () => {
      const [checked, setChecked] = useState(false);
      return (
        <SettingList aria-label="Preferences">
          <SettingListItem label="Link previews" description="Show previews of linked pages.">
            <Switch checked={checked} onCheckedChange={(value) => (setChecked(value), changed(value))} />
          </SettingListItem>
        </SettingList>
      );
    };
    render(<Harness />);

    fireEvent.click(screen.getByText("Link previews"));

    expect(screen.getByRole("switch", { name: "Link previews" })).toBeChecked();
    expect(changed).toHaveBeenCalledWith(true);
  });
});
