import { type PersistedWidthConfig, usePersistedWidth } from "@/components/AppSidebar";

/** Custom property the panel publishes; `DayPanelAside` repeats the literal in its width class. */
export const DAY_PANEL_WIDTH_VAR = "--calendar-day-panel-width";
export const DAY_PANEL_DEFAULT_WIDTH = 384;
const DAY_PANEL_MIN_WIDTH = 320;
const DAY_PANEL_MAX_WIDTH = 640;
/** App sidebar, page padding and the gap beside the grid, plus seven legible 72px columns. */
const RESERVED_BESIDE_PANEL = 256 + 48 + 24 + 7 * 72;

const DAY_PANEL_WIDTH_CONFIG: PersistedWidthConfig = {
  storageKey: "memos-calendar-day-panel-width",
  defaultWidth: DAY_PANEL_DEFAULT_WIDTH,
  minWidth: DAY_PANEL_MIN_WIDTH,
  maxWidthFor: (viewportWidth) => Math.min(DAY_PANEL_MAX_WIDTH, viewportWidth - RESERVED_BESIDE_PANEL),
};

/** Width of the inline day panel beside the month grid, persisted like the sidebar's. */
export const useDayPanelWidth = () => usePersistedWidth(DAY_PANEL_WIDTH_CONFIG);
