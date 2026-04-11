import { Tag } from "../../model/types";
import { TagIcon } from "./TagIcon";
import { useTagManager } from "./useTagManager";

interface Props {
  tags: Tag[];
  selectedFilterTagIds: string[];
  onSelectedFilterTagIdsChange: (tagIds: string[]) => void;
}

export function TagManager({
  tags,
  selectedFilterTagIds,
  onSelectedFilterTagIdsChange,
}: Props) {
  const { handleToggleFilterTag } = useTagManager({
    selectedFilterTagIds,
    onSelectedFilterTagIdsChange,
  });

  return (
    <div>
      {tags.length > 0 && (
        <ul>
          {tags.map((tag) => (
            <li key={tag.id}>
              <button
                onClick={() => handleToggleFilterTag(tag.id)}
                className="w-full text-left py-1 text-sm rounded flex items-center gap-1"
                title="Toggle tag filter"
              >
                <span className="flex min-w-0 items-center gap-1">
                  <TagIcon />
                  <span
                    style={{ fontWeight: "400" }}
                    className="truncate block text-[18px] font-normal leading-[19.5px] tracking-[-0.076px] text-dark-90"
                  >
                    {tag.name}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
