import { isEqual } from "lodash-es";
import toast from "react-hot-toast";
import { cn } from "@/utils";

// Helper function to convert Date to local datetime string.
const toLocalDateTimeString = (date: Date | undefined): string => {
  return date?.toLocaleString() || "";
};

// Helper function to convert Date to ISO string in local timezone.
const toLocalDateISOString = (date: Date | undefined): string => {
  if (!date) return "";
  return new Date(date.getTime() - date.getTimezoneOffset() * 60 * 1000).toISOString().slice(0, 19);
};

interface Props {
  value: Date | undefined;
  originalValue: Date | undefined;
  onChange: (date: Date) => void;
}

const DateTimeInput: React.FC<Props> = ({ value, originalValue, onChange }) => {
  return (
    <input
      type="text"
      className={cn(
        "px-1 bg-transparent rounded text-xs transition-all",
        "border-transparent outline-none focus:border-gray-300 dark:focus:border-zinc-700",
        !isEqual(value, originalValue) && "border-gray-300 dark:border-zinc-700",
        "border",
      )}
      defaultValue={toLocalDateTimeString(value)}
      onFocus={(e) => {
        e.target.value = toLocalDateISOString(value);
      }}
      onBlur={(e) => {
        const inputValue = e.target.value;
        if (inputValue) {
          const date = new Date(inputValue);
          if (!isNaN(date.getTime())) {
            onChange(date);
            e.target.value = toLocalDateTimeString(date);
          } else {
            toast.error("Invalid datetime format. Use format: 2023-12-31T23:59:59");
            e.target.value = toLocalDateTimeString(value);
          }
        }
      }}
      placeholder="YYYY-MM-DDTHH:mm:ss"
    />
  );
};

export default DateTimeInput;
