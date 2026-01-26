import { Timestamp, timestampDate } from "@bufbuild/protobuf/wkt";
import { PencilIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { cn } from "@/lib/utils";

interface Props {
  timestamp: Timestamp | undefined;
  onChange: (date: Date) => void;
  className?: string;
}

const EditableTimestamp = ({ timestamp, onChange, className }: Props) => {
  const [isEditing, setIsEditing] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const date = timestamp ? timestampDate(timestamp) : new Date();
  const displayValue = date.toLocaleString();

  // Format date for datetime-local input (YYYY-MM-DDTHH:mm)
  const formatForInput = (d: Date): string => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const hours = String(d.getHours()).padStart(2, "0");
    const minutes = String(d.getMinutes()).padStart(2, "0");
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.showPicker?.(); // Open datetime picker if available
    }
  }, [isEditing]);

  const handleEdit = () => {
    setInputValue(formatForInput(date));
    setIsEditing(true);
  };

  const handleSave = () => {
    if (!inputValue) {
      setIsEditing(false);
      return;
    }

    const newDate = new Date(inputValue);
    if (isNaN(newDate.getTime())) {
      toast.error("Invalid date format");
      return;
    }

    onChange(newDate);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setInputValue("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleSave();
    } else if (e.key === "Escape") {
      handleCancel();
    }
  };

  if (isEditing) {
    return (
      <input
        ref={inputRef}
        type="datetime-local"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onBlur={handleSave}
        onKeyDown={handleKeyDown}
        className={cn(
          "w-full px-2 py-1.5 text-sm text-foreground bg-background rounded-md border border-border outline-none transition-all focus:border-ring focus:ring-1 focus:ring-ring/20",
          className,
        )}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={handleEdit}
      className={cn(
        "group w-full text-left px-2 py-1.5 text-sm text-foreground/80 rounded-md transition-all flex items-center justify-between hover:bg-accent/50 hover:text-foreground",
        className,
      )}
    >
      <span className="font-normal">{displayValue}</span>
      <PencilIcon className="w-3.5 h-3.5 opacity-0 group-hover:opacity-40 transition-opacity shrink-0 text-muted-foreground" />
    </button>
  );
};

export default EditableTimestamp;
