import { EmojiPicker, EmojiPickerListCategoryHeaderProps } from "frimousse";
import { HashIcon, XIcon } from "lucide-react";
import * as React from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/Popover";

interface EmojiPickerPopoverProps {
  /** Current emoji value, if any */
  emoji?: string;
  /** Callback when emoji is selected */
  onEmojiSelect: (emoji: string) => void;
  /** Callback when emoji is removed */
  onEmojiRemove: () => void;
  /** Additional className for the trigger */
  className?: string;
}

export const EmojiPickerPopover: React.FC<EmojiPickerPopoverProps> = ({ emoji, onEmojiSelect, onEmojiRemove, className = "" }) => {
  const [isOpen, setIsOpen] = React.useState(false);
  const [hoveredEmoji, setHoveredEmoji] = React.useState<{ emoji: string; name: string } | null>(null);

  const handleEmojiSelect = (selectedEmoji: string) => {
    onEmojiSelect(selectedEmoji);
    setIsOpen(false);
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <div
          className={`
            bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-700 dark:hover:bg-neutral-600 
            rounded-md size-6 flex items-center justify-center transition-colors cursor-pointer
            ${className}
          `}
        >
          {emoji ? (
            <span className="text-sm leading-none">{emoji}</span>
          ) : (
            <HashIcon className="w-3 h-3 text-gray-400 dark:text-gray-500" />
          )}
        </div>
      </PopoverTrigger>
      <PopoverContent className="!p-0 overflow-hidden" align="start">
        <EmojiPicker.Root
          className="isolate flex h-[380px] flex-col bg-white dark:bg-neutral-900"
          onEmojiSelect={({ emoji: selectedEmoji }) => {
            handleEmojiSelect(selectedEmoji);
          }}
        >
          {/* Search bar with delete button */}
          <div className="flex items-center gap-2 mx-2 mt-2 mb-1">
            {emoji && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onEmojiRemove();
                  setIsOpen(false);
                }}
                className="flex-shrink-0 p-1.5 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors"
                title="Remove emoji"
              >
                <XIcon className="w-4 h-4" />
              </button>
            )}
            <EmojiPicker.Search
              placeholder="Search emoji..."
              className="flex-1 appearance-none rounded-md bg-neutral-100 px-2.5 py-1.5 text-sm dark:bg-neutral-800"
            />
          </div>
          <EmojiPicker.Viewport className="relative flex-1 outline-hidden">
            <EmojiPicker.Loading className="absolute inset-0 flex items-center justify-center text-neutral-400 text-sm dark:text-neutral-500">
              Loading…
            </EmojiPicker.Loading>
            <EmojiPicker.Empty className="absolute inset-0 flex items-center justify-center text-neutral-400 text-sm dark:text-neutral-500">
              No emoji found.
            </EmojiPicker.Empty>
            <EmojiPicker.List
              className="select-none pb-1.5"
              components={{
                CategoryHeader: ({ category, ...props }: EmojiPickerListCategoryHeaderProps) => (
                  <div
                    className="bg-white px-3 pt-3 pb-1.5 font-medium text-neutral-600 text-xs dark:bg-neutral-900 dark:text-neutral-400"
                    {...props}
                  >
                    {category.label}
                  </div>
                ),
                Row: ({ children, ...props }) => (
                  <div className="scroll-my-1.5 px-1.5" {...props}>
                    {children}
                  </div>
                ),
                Emoji: ({ emoji, ...props }) => (
                  <div
                    onMouseEnter={() => setHoveredEmoji({ emoji: emoji.emoji, name: emoji.label })}
                    onMouseLeave={() => setHoveredEmoji(null)}
                  >
                    <button
                      {...props}
                      className="flex size-8 items-center justify-center rounded-md text-lg data-[active]:bg-neutral-100 dark:data-[active]:bg-neutral-800"
                    >
                      {emoji.emoji}
                    </button>
                  </div>
                ),
              }}
            />
          </EmojiPicker.Viewport>

          {/* Preview Section */}
          <div className="border-t w-full max-w-[var(--frimousse-viewport-width)] border-neutral-200 dark:border-neutral-700 px-2 py-1.5">
            <div className="flex items-center justify-between min-h-[32px]">
              {hoveredEmoji ? (
                <>
                  <div className="flex items-center space-x-2 flex-1 min-w-0">
                    <span className="text-lg flex-shrink-0">{hoveredEmoji.emoji}</span>
                    <span className="text-xs text-neutral-600 dark:text-neutral-400 font-medium truncate">{hoveredEmoji.name}</span>
                  </div>
                  <div className="flex-shrink-0 ml-2">
                    <div className="bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-700 dark:hover:bg-neutral-600 rounded-md size-8 flex items-center justify-center transition-colors cursor-pointer">
                      <EmojiPicker.SkinToneSelector />
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center space-x-2 text-neutral-400 dark:text-neutral-500">
                    <span className="text-xs">Hover over an emoji to preview</span>
                  </div>
                  <div className="flex-shrink-0">
                    <div className="bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-700 dark:hover:bg-neutral-600 rounded-md size-8 flex items-center justify-center transition-colors cursor-pointer">
                      <EmojiPicker.SkinToneSelector />
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </EmojiPicker.Root>
      </PopoverContent>
    </Popover>
  );
};
