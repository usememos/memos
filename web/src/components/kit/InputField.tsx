import React from "react";
import { LucideIcon } from "lucide-react";

interface Props extends React.InputHTMLAttributes<HTMLInputElement> {
  className?: string;
  containerClassName?: string;
  icon?: LucideIcon;
  iconProps?: React.ComponentProps<LucideIcon>;
}

const InputField = React.forwardRef<HTMLInputElement, Props>(({ icon, iconProps, containerClassName, className, ...props }, ref) => {
  const Icon = icon; // can't use lowercase jsx elements as custom react elements, so we must change the casing
  return (
    <div
      className={
        "w-full h-9 flex flex-row justify-start items-center py-2 px-3 rounded-md bg-gray-200 dark:bg-zinc-700" +
        (containerClassName ? ` ${containerClassName}` : "")
      }
    >
      {Icon && (
        <Icon
          {...iconProps}
          className={"w-4 h-auto opacity-30 dark:text-gray-200" + (iconProps?.className ? ` ${iconProps.className}` : "")}
        />
      )}
      <input
        ref={ref}
        {...props}
        className={"flex ml-2 w-24 grow text-sm outline-none bg-transparent dark:text-gray-200" + (className ? `  ${className}` : "")}
      />
    </div>
  );
});
InputField.displayName = "InputField";

export default InputField;
