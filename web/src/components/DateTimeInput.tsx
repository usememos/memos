import { isEqual } from "lodash-es";
import toast from "react-hot-toast";
import { cn } from "@/utils";

// Helper function to convert Date to local datetime string.
const toLocalDateTimeString = (date: Date | undefined): string => {
  if (!date) return "";
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, -1);
};

interface Props {
  label: string;
  value: Date | undefined;
  originalValue: Date | undefined;
  onChange: (date: Date) => void;
}

const DateTimeInput: React.FC<Props> = ({ label, value, originalValue, onChange }) => {
  return (
    <div className="w-full flex items-center gap-2">
      <span>{label}</span>
      <input
        type="text"
        className={cn(
          "flex-1 px-1 bg-transparent rounded text-xs transition-all",
          "border-transparent focus:border-gray-300 dark:focus:border-zinc-700",
          !isEqual(value, originalValue) && "border-gray-300 dark:border-zinc-700",
          "border",
        )}
        defaultValue={toLocalDateTimeString(value)}
        onBlur={(e) => {
          const inputValue = e.target.value;
          if (inputValue) {
            const date = new Date(inputValue);
            if (!isNaN(date.getTime())) {
              onChange(date);
            } else {
              toast.error("Invalid datetime format. Use format: 2023-12-31T23:59:59");
              e.target.value = toLocalDateTimeString(value);
            }
          }
        }}
        placeholder="YYYY-MM-DDTHH:mm:ss"
      />
    </div>
  );
};

export default DateTimeInput;
