import dayjs from "dayjs";
import toast from "react-hot-toast";
import { cn } from "@/lib/utils";

// ISO 8601 (almost)
const DATE_TIME_FORMAT = "YYYY-MM-DD HH:mm:ss";

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
          const date = dayjs(inputValue).toDate();
          // Check if the date is valid.
          if (!isNaN(date.getTime())) {
            onChange(date);
          } else {
            toast.error(
              <span>
              Invalid datetime.<br/>
              Use a{" "}
              <a
                class="underline text-primary hover:text-primary/80"
                href="https://developer.mozilla.org/ru/docs/Web/JavaScript/Reference/Global_Objects/Date#datestring" target="_blank">
                Date.parse()
              </a>
              -compatible format,<br/>
              e.g., <code>2023-12-31 23:59:59</code><br/>
              or <code>31/12/2023, 23:59:59</code>.
              </span>
            );
            e.target.value = formatDate(value);
          }
        }
      }}
      placeholder={DATE_TIME_FORMAT}
    />
  );
};

export default DateTimeInput;
