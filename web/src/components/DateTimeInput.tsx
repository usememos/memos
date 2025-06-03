import dayjs from "dayjs";
import { isEqual } from "lodash-es";
import toast from "react-hot-toast";
import { cn } from "@/utils";

// convert Date to datetime string.
const formatDate = (date: Date | undefined): string => {
  return dayjs(date).format("M/D/YYYY, H:mm:ss");
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
      defaultValue={formatDate(value)}
      onBlur={(e) => {
        const inputValue = e.target.value;
        if (inputValue) {
          const date = new Date(inputValue);
          if (!isNaN(date.getTime())) {
            onChange(date);
          } else {
            toast.error("Invalid datetime format. Use format: 12/31/2023, 23:59:59");
            e.target.value = formatDate(value);
          }
        }
      }}
      placeholder="M/D/YYYY, H:mm:ss"
    />
  );
};

export default DateTimeInput;
