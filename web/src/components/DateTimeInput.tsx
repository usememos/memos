import dayjs from "dayjs";
import { showErrorToast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { useTranslate } from "@/utils/i18n";

// must be compatible with JS Date.parse(), we use ISO 8601 (almost)
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
  const t = useTranslate();
  return (
    <input
      type="datetime-local"
      className={cn(
        "px-1 bg-transparent rounded mu-caption transition-all",
        "border-transparent outline-none focus:border-mu-line",
        "border",
      )}
      defaultValue={formatDate(value)}
      onBlur={(e) => {
        const inputValue = e.target.value;
        if (inputValue) {
          // note: inputValue must be compatible with JS Date.parse()
          const date = dayjs(inputValue).toDate();
          // Check if the date is valid.
          if (!isNaN(date.getTime())) {
            onChange(date);
          } else {
            showErrorToast(t("message.invalid-datetime"));
            e.target.value = formatDate(value);
          }
        }
      }}
      placeholder={DATE_TIME_FORMAT}
    />
  );
};

export default DateTimeInput;
