import Picker, { IEmojiPickerProps } from "emoji-picker-react";
import { useEffect, useState } from "react";

interface Props {
  shouldShow: boolean;
  onEmojiClick: IEmojiPickerProps["onEmojiClick"];
  onShouldShowEmojiPickerChange: (status: boolean) => void;
}

interface State {
  hasShown: boolean;
}

export const EmojiPicker: React.FC<Props> = (props: Props) => {
  const { shouldShow, onEmojiClick, onShouldShowEmojiPickerChange } = props;
  const [state, setState] = useState<State>({
    hasShown: false,
  });

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
      setState({
        hasShown: true,
      });
    }
  }, [shouldShow]);

  return (
    <>
      {state.hasShown && (
        <div className={`emoji-picker ${shouldShow ? "" : "hidden"}`}>
          <Picker onEmojiClick={onEmojiClick} disableSearchBar />
        </div>
      )}
    </>
  );
};

export default EmojiPicker;
