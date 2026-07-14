// Shared enter/exit motion for popup surfaces (dropdown menu, popover, tooltip), driven by
// Base UI's data-starting-style/data-ending-style attributes. Keep in one place so all
// popups animate identically; select.tsx uses a closer-range variant of the same pattern.
export const popupMotionClasses =
  "transition-[opacity,scale,translate] duration-150 data-starting-style:scale-95 data-starting-style:opacity-0 data-ending-style:scale-95 data-ending-style:opacity-0 data-[side=bottom]:data-starting-style:-translate-y-2 data-[side=bottom]:data-ending-style:-translate-y-2 data-[side=left]:data-starting-style:translate-x-2 data-[side=left]:data-ending-style:translate-x-2 data-[side=right]:data-starting-style:-translate-x-2 data-[side=right]:data-ending-style:-translate-x-2 data-[side=top]:data-starting-style:translate-y-2 data-[side=top]:data-ending-style:translate-y-2";
