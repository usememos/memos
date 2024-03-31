import { useEffect, useState } from "react";
import { tagServiceClient } from "@/grpcweb";
import { Tag } from "@/types/proto/api/v2/tag_service";
import Icon from "../Icon";

const TagsSection = () => {
  const [tags, setTags] = useState<Tag[]>([]);

  useEffect(() => {
    (async () => {
      const { tags } = await tagServiceClient.listTags({});
      setTags(tags);
    })();
  }, []);

  return (
    tags.length > 0 && (
      <div className="w-full mt-2 flex flex-col p-2 bg-gray-50 dark:bg-black rounded-lg">
        <div className="w-full flex flex-row justify-between items-center">
          <span className="text-gray-400 font-medium text-sm pl-1">Tags</span>
        </div>
        <div className="w-full flex flex-row justify-start items-center flex-wrap">
          {tags.map((tag) => (
            <div
              key={tag.name}
              className="w-auto max-w-full px-1 flex flex-row justify-start items-center text-gray-500 hover:bg-gray-100 dark:hover:bg-zinc-900 rounded-lg"
            >
              <Icon.Hash className="w-4 h-auto opacity-80" />
              {tag.name}
            </div>
          ))}
        </div>
      </div>
    )
  );
};

export default TagsSection;
