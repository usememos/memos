import * as React from "react";
import { Button, type VariantProps } from "./button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  type DropdownMenuContentProps,
} from "./dropdown-menu";

interface ButtonWithDropdownProps extends VariantProps<typeof Button> {
  children: React.ReactNode;
  menuContent: React.ReactNode;
  dropdownContentProps?: Omit<DropdownMenuContentProps, "children">;
  className?: string;
}

const ButtonWithDropdown = React.forwardRef<HTMLButtonElement, ButtonWithDropdownProps>(
  ({ children, menuContent, variant, size, dropdownContentProps, className, ...props }, ref) => {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            ref={ref}
            variant={variant}
            size={size}
            className={className}
            hasIconDivider
            {...props}
          >
            {children}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent {...dropdownContentProps}>
          {menuContent}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }
);

ButtonWithDropdown.displayName = "ButtonWithDropdown";

export { ButtonWithDropdown };