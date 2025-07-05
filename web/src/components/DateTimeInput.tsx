import dayjs from "dayjs";
import toast from "react-hot-toast";
import { cn } from "@/lib/utils";

const DATE_TIME_FORMAT = "M/D/YYYY, H:mm:ss";

// convert Date to datetime string.
const formatDate = (date: Date): string => {
  return dayjs(date).format(DATE_TIME_FORMAT);
};

interface Props {
  value: Date;
  onChange: (date: Date) => void;
}

const DateTimeInput: React.FC<Props> = ({ value, onChange }) => {
  return (
    <input
      type="text"
      className={cn("px-1 bg-transparent rounded text-xs transition-all", "border-transparent outline-none focus:border-border", "border")}
      defaultValue={formatDate(value)}
      onBlur={(e) => {
        const inputValue = e.target.value;
        if (inputValue) {
          const date = dayjs(inputValue, DATE_TIME_FORMAT, true).toDate();
          // Check if the date is valid.
          if (!isNaN(date.getTime())) {
            onChange(date);
          } else {
            toast.error("Invalid datetime format. Use format: 12/31/2023, 23:59:59");
            e.target.value = formatDate(value);
          }
        }
      }}
      placeholder={DATE_TIME_FORMAT}
    />
  );
};

export default DateTimeInput;
