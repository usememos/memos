import { useMemo } from "react";
import { MemoEditor } from "@/components/MemoEditor";
import { deriveDefaultCreateTimeFromFilters } from "@/components/MemoEditor/edit/utils/deriveDefaultCreateTime";
import MemoView from "@/components/MemoView";
import PagedMemoList, { getMemoKey } from "@/components/PagedMemoList";
import { useAuth } from "@/contexts/AuthContext";
import { useGlobalMemoEditor } from "@/contexts/GlobalMemoEditorContext";
import { useMemoFilterContext } from "@/contexts/MemoFilterContext";
import { NewMemoProvider } from "@/contexts/NewMemoContext";
import { useSpaceContext } from "@/contexts/SpaceContext";
import { useMemoFilters, useMemoSorting } from "@/hooks";
import useCurrentUser from "@/hooks/useCurrentUser";
import { useMemoSuggestions } from "@/hooks/useMemoSuggestions";
import { State } from "@/types/proto/api/common_pb";
import { Memo } from "@/types/proto/api/memo_service_pb";
import { useTranslate } from "@/utils/i18n";

const Home = () => {
  const user = useCurrentUser();
  const suggestions = useMemoSuggestions();
  const t = useTranslate();
  const { isUserSettingsInitialized } = useAuth();
  const { claimHomeAutoFocus } = useGlobalMemoEditor();
  const { filters } = useMemoFilterContext();
  const { memoFilter: contextFilter, selectedSpaceName, creatorUsername } = useSpaceContext();
  const defaultCreateTime = useMemo(() => deriveDefaultCreateTimeFromFilters(filters), [filters]);

  const memoFilter = useMemoFilters({
    includeMemoViews: true,
    includePinned: true,
  });
  const canComposeInScope = Boolean(user && (!creatorUsername || creatorUsername === user.username));
  // Pinning is the owner's arrangement of their own memos, so it only shapes a single
  // creator's feed; a mixed-author feed like Explore stays purely chronological.
  const honorPinned = Boolean(creatorUsername);

  const { listSort, orderBy } = useMemoSorting({
    pinnedFirst: honorPinned,
    state: State.NORMAL,
  });

  return (
    <div className="w-full min-h-full bg-background text-foreground">
      <NewMemoProvider>
        <PagedMemoList
          renderer={(memo: Memo, { compact }) => (
            <MemoView
              key={getMemoKey(memo)}
              memo={memo}
              showCreator={!creatorUsername}
              showVisibility
              showPinned={honorPinned}
              showSpace={!selectedSpaceName}
              compact={compact}
            />
          )}
          listSort={listSort}
          orderBy={orderBy}
          filter={memoFilter}
          contextFilter={contextFilter}
          renderLeading={({ useGrid }) => {
            if (!isUserSettingsInitialized || !canComposeInScope) return null;

            return (
              <MemoEditor
                // Each Space keeps its own Home draft; the editor restarts when the Space changes.
                draft={{ scope: "home", space: selectedSpaceName, createTime: defaultCreateTime }}
                autoFocus={claimHomeAutoFocus}
                className={useGrid ? undefined : "mb-2"}
                placeholder={t("editor.any-thoughts")}
                suggestions={suggestions}
              />
            );
          }}
        />
      </NewMemoProvider>
    </div>
  );
};

export default Home;
