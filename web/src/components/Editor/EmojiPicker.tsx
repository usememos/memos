import { forwardRef, useEffect } from "react";
import Picker, { IEmojiPickerProps } from "emoji-picker-react";

type EmojiPickerElement = HTMLDivElement;

interface Props {
  isShowEmojiPicker: boolean;
  onEmojiClick: IEmojiPickerProps["onEmojiClick"];
  handleChangeIsShowEmojiPicker: (status: boolean) => void;
}

export const EmojiPicker = forwardRef<EmojiPickerElement, Props>((props: Props, ref) => {
  const { isShowEmojiPicker, onEmojiClick, handleChangeIsShowEmojiPicker } = props;

  useEffect(() => {
    if (isShowEmojiPicker) {
      const handleClickOutside = (event: MouseEvent) => {
        const emojiWrapper = document.querySelector(".emoji-picker-react");
        const isContains = emojiWrapper?.contains(event.target as Node);
        if (!isContains) {
          handleChangeIsShowEmojiPicker(false);
        }
      };
      document.addEventListener("mousedown", handleClickOutside);
      return () => {
        // Unbind the event listener on clean up
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }
  }, [isShowEmojiPicker]);

  return (
    <div className="emoji-picker" ref={ref}>
      <Picker onEmojiClick={onEmojiClick} disableSearchBar />
    </div>
  );
});

EmojiPicker.displayName = "EmojiPicker";

export default EmojiPicker;
