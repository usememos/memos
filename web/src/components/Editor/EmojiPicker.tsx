import Picker, { IEmojiPickerProps } from "emoji-picker-react";
import { useEffect } from "react";

interface Props {
  shouldShow: boolean;
  onEmojiClick: IEmojiPickerProps["onEmojiClick"];
  onShouldShowEmojiPickerChange: (status: boolean) => void;
}

export const EmojiPicker: React.FC<Props> = (props: Props) => {
  const { shouldShow, onEmojiClick, onShouldShowEmojiPickerChange } = props;

  useEffect(() => {
    if (shouldShow) {
      const handleClickOutside = (event: MouseEvent) => {
        event.stopPropagation();
        const emojiWrapper = document.querySelector(".emoji-picker-react");
        const isContains = emojiWrapper?.contains(event.target as Node);
        if (!isContains) {
          onShouldShowEmojiPickerChange(false);
        }
      };

      window.addEventListener("click", handleClickOutside, {
        capture: true,
        once: true,
      });
    }
  }, [shouldShow]);

  return (
    <div className={`emoji-picker ${shouldShow ? "" : "hidden"}`}>
      <Picker onEmojiClick={onEmojiClick} disableSearchBar />
    </div>
  );
};

export default EmojiPicker;
