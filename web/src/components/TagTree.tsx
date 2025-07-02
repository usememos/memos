import { ChevronRightIcon, PinIcon } from "lucide-react";
import { useEffect, useState } from "react";
import useToggle from "react-use/lib/useToggle";
import { useMemoFilterStore, useTag } from "@/store/v1";
import { EmojiPickerPopover } from "./EmojiPickerPopover";

interface Tag {
  key: string;
  text: string;
  amount: number;
  subTags: Tag[];
}

interface Props {
  tagAmounts: [tag: string, amount: number][];
}

const TagTree = ({ tagAmounts: rawTagAmounts }: Props) => {
  const [tags, setTags] = useState<Tag[]>([]);
  const [pinnedTags, setPinnedTags] = useState<Tag[]>([]);
  const [unpinnedTags, setUnpinnedTags] = useState<Tag[]>([]);
  const { fetchEmojiTags, fetchPinnedTags, pinnedTags: pinnedTagsFromStore } = useTag();

  useEffect(() => {
    const sortedTagAmounts = Array.from(rawTagAmounts).sort();
    const root: Tag = {
      key: "",
      text: "",
      amount: 0,
      subTags: [],
    };

    for (const tagAmount of sortedTagAmounts) {
      const subtags = tagAmount[0].split("/");
      let tempObj = root;
      let tagText = "";

      for (let i = 0; i < subtags.length; i++) {
        const key = subtags[i];
        let amount: number = 0;

        if (i === 0) {
          tagText += key;
        } else {
          tagText += "/" + key;
        }
        if (sortedTagAmounts.some(([tag, amount]) => tag === tagText && amount > 1)) {
          amount = tagAmount[1];
        }

        let obj = null;

        for (const t of tempObj.subTags) {
          if (t.text === tagText) {
            obj = t;
            break;
          }
        }

        if (!obj) {
          obj = {
            key,
            text: tagText,
            amount: amount,
            subTags: [],
          };
          tempObj.subTags.push(obj);
        }

        tempObj = obj;
      }
    }

    setTags(root.subTags as Tag[]);
  }, [rawTagAmounts]);

  // Separate pinned and unpinned tags
  useEffect(() => {
    const pinnedTagNames = pinnedTagsFromStore.map((tag) => tag.tagName);
    const unpinned: Tag[] = [];

    // For unpinned tags, use the alphabetically sorted order from tags
    tags.forEach((tag) => {
      if (!pinnedTagNames.includes(tag.text)) {
        unpinned.push(tag);
      }
    });

    // For pinned tags, maintain the server order (time-based) by creating them from pinnedTagsFromStore
    const pinned: Tag[] = [];
    pinnedTagsFromStore.forEach((pinnedTag) => {
      // Find the corresponding tag from tags array to get the full structure with subTags
      const fullTag = tags.find((tag) => tag.text === pinnedTag.tagName);
      if (fullTag) {
        pinned.push(fullTag);
      }
    });

    setPinnedTags(pinned);
    setUnpinnedTags(unpinned);
  }, [tags, pinnedTagsFromStore]);

  // Fetch emoji tags and pinned tags when component mounts
  useEffect(() => {
    fetchEmojiTags().catch((error) => {
      console.error("Failed to fetch emoji tags:", error);
    });
    fetchPinnedTags().catch((error) => {
      console.error("Failed to fetch pinned tags:", error);
    });
  }, [fetchEmojiTags, fetchPinnedTags]);

  return (
    <div className="flex flex-col justify-start items-start relative w-full h-auto flex-nowrap gap-2 mt-1">
      {/* Render pinned tags */}
      {pinnedTags.length > 0 && (
        <>
          {pinnedTags.map((t, idx) => (
            <TagItemContainer key={t.text + "-pinned-" + idx} tag={t} isPinned={true} />
          ))}
          <div className="w-full h-px bg-gray-300 dark:bg-zinc-500 my-1" />
        </>
      )}

      {/* Render unpinned tags */}
      {unpinnedTags.map((t, idx) => (
        <TagItemContainer key={t.text + "-unpinned-" + idx} tag={t} isPinned={false} />
      ))}
    </div>
  );
};

interface TagItemContainerProps {
  tag: Tag;
  isPinned?: boolean;
}

const TagItemContainer: React.FC<TagItemContainerProps> = (props: TagItemContainerProps) => {
  const { tag, isPinned = false } = props;
  const memoFilterStore = useMemoFilterStore();
  const { emojiTags, updateTagEmoji, pinTag, unpinTag } = useTag();
  const tagFilters = memoFilterStore.getFiltersByFactor("tagSearch");
  const isActive = tagFilters.some((f) => f.value === tag.text);
  const hasSubTags = tag.subTags.length > 0;
  const [showSubTags, toggleSubTags] = useToggle(false);
  const [isHovered, setIsHovered] = useState(false);

  // Find emoji for this tag
  const tagEmoji = emojiTags.find((t) => t.tagName === tag.text)?.emoji;

  // Check if this is a first-level tag (no "/" in the text)
  const isFirstLevelTag = !tag.text.includes("/");

  const handleTagClick = () => {
    if (isActive) {
      memoFilterStore.removeFilter((f) => f.factor === "tagSearch" && f.value === tag.text);
    } else {
      memoFilterStore.addFilter({
        factor: "tagSearch",
        value: tag.text,
      });
    }
  };

  const handleToggleBtnClick = (event: React.MouseEvent) => {
    event.stopPropagation();
    toggleSubTags();
  };

  const handlePinClick = async (event: React.MouseEvent) => {
    event.stopPropagation();
    try {
      if (isPinned) {
        await unpinTag(tag.text);
      } else {
        await pinTag(tag.text);
      }
    } catch (error) {
      console.error("Failed to toggle pin status:", error);
    }
  };

  const handleEmojiSelect = async (emoji: string) => {
    try {
      await updateTagEmoji(tag.text, emoji);
    } catch (error) {
      console.error("Failed to update tag emoji:", error);
    }
  };

  const handleEmojiRemove = async () => {
    try {
      await updateTagEmoji(tag.text, null);
    } catch (error) {
      console.error("Failed to remove tag emoji:", error);
    }
  };

  return (
    <>
      <div
        className="relative flex flex-row justify-between items-center w-full leading-6 py-0 mt-px rounded-lg text-sm select-none shrink-0"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <div
          className={`flex flex-row justify-start items-center truncate shrink leading-5 mr-1 text-gray-600 dark:text-gray-400 ${
            isActive && "!text-blue-600"
          }`}
        >
          <div className="shrink-0 mr-1">
            <EmojiPickerPopover emoji={tagEmoji} onEmojiSelect={handleEmojiSelect} onEmojiRemove={handleEmojiRemove} />
          </div>
          <span className="truncate cursor-pointer hover:opacity-80" onClick={handleTagClick}>
            {tag.key} {tag.amount > 1 && `(${tag.amount})`}
          </span>
        </div>
        <div className="flex flex-row justify-end items-center">
          {/* Pin/Unpin button - only show for first-level tags and on hover */}
          {isFirstLevelTag && (
            <span
              className={`flex flex-row justify-center items-center w-6 h-6 shrink-0 transition-all ${
                isHovered ? "opacity-100" : "opacity-0"
              }`}
              onClick={handlePinClick}
            >
              <PinIcon
                className={`w-4 h-4 cursor-pointer transition-colors ${
                  isPinned ? "text-blue-500 fill-blue-500" : "text-gray-400 dark:text-gray-500 hover:text-blue-500"
                }`}
              />
            </span>
          )}
          {hasSubTags ? (
            <span
              className={`flex flex-row justify-center items-center w-6 h-6 shrink-0 transition-all rotate-0 ${showSubTags && "rotate-90"}`}
              onClick={handleToggleBtnClick}
            >
              <ChevronRightIcon className="w-5 h-5 cursor-pointer text-gray-400 dark:text-gray-500" />
            </span>
          ) : null}
        </div>
      </div>
      {hasSubTags ? (
        <div
          className={`w-[calc(100%-0.5rem)] flex flex-col justify-start items-start h-auto ml-2 pl-2 border-l-2 border-l-gray-200 dark:border-l-zinc-800 ${
            !showSubTags && "!hidden"
          }`}
        >
          {tag.subTags.map((st, idx) => (
            <TagItemContainer key={st.text + "-" + idx} tag={st} isPinned={false} />
          ))}
        </div>
      ) : null}
    </>
  );
};

export default TagTree;
