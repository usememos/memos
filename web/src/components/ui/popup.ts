// Shared enter/exit motion for popup surfaces (dropdown menu, popover, tooltip), driven by
// Base UI's data-starting-style/data-ending-style attributes. Keep in one place so all
// popups animate consistently and respect reduced-motion preferences.
//
// Layout note for consumers: while a popup is open, Base UI inserts focus-guard spans as
// siblings of the trigger. They are fixed-position and take no space, but they do make the
// trigger stop being `:last-child` — so a `space-y-*` parent starts applying its margin to it
// and everything below shifts (#6154). Space a stack that contains a popup trigger with
// `flex flex-col gap-*`, which ignores out-of-flow children.
// Neutral surfaces share the theme's popover pair; primary is reserved for actions.
export const popupSurfaceClasses =
  "bg-popover text-popover-foreground rounded-lg border border-border/70 shadow-float text-ui font-normal leading-5 tracking-normal";

export const popupMotionClasses =
  "transition-[opacity,scale,translate] duration-150 ease-out data-starting-style:scale-[0.98] data-starting-style:opacity-0 data-ending-style:scale-[0.98] data-ending-style:opacity-0 data-[side=bottom]:data-starting-style:-translate-y-1 data-[side=bottom]:data-ending-style:-translate-y-1 data-[side=left]:data-starting-style:translate-x-1 data-[side=left]:data-ending-style:translate-x-1 data-[side=right]:data-starting-style:-translate-x-1 data-[side=right]:data-ending-style:-translate-x-1 data-[side=inline-start]:data-starting-style:translate-x-1 data-[side=inline-start]:data-ending-style:translate-x-1 rtl:data-[side=inline-start]:data-starting-style:-translate-x-1 rtl:data-[side=inline-start]:data-ending-style:-translate-x-1 data-[side=inline-end]:data-starting-style:-translate-x-1 data-[side=inline-end]:data-ending-style:-translate-x-1 rtl:data-[side=inline-end]:data-starting-style:translate-x-1 rtl:data-[side=inline-end]:data-ending-style:translate-x-1 data-[side=top]:data-starting-style:translate-y-1 data-[side=top]:data-ending-style:translate-y-1 motion-reduce:transition-none motion-reduce:transform-none motion-reduce:translate-none motion-reduce:scale-100";
