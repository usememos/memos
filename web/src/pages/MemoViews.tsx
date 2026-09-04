import { create } from "@bufbuild/protobuf";
import { FieldMaskSchema } from "@bufbuild/protobuf/wkt";
import { useQueryClient } from "@tanstack/react-query";
import {
  AstroidIcon,
  CheckCircle2Icon,
  ClipboardCheckIcon,
  Clock3Icon,
  ExternalLinkIcon,
  FilterIcon,
  MapPinIcon,
  MoreVerticalIcon,
  PencilIcon,
  PinIcon,
  PlusIcon,
  SaveIcon,
  SearchIcon,
  ShieldIcon,
  TagsIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { useLocation, useNavigate } from "react-router-dom";
import ConfirmDialog from "@/components/ConfirmDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { memoViewServiceClient } from "@/connect";
import { useMemoFilterContext } from "@/contexts/MemoFilterContext";
import useCurrentUser from "@/hooks/useCurrentUser";
import useLoading from "@/hooks/useLoading";
import { useMemoViews, userKeys } from "@/hooks/useUserQueries";
import { handleError } from "@/lib/error";
import { getMemoViewId } from "@/lib/memo-views";
import { cn } from "@/lib/utils";
import { MemoView, MemoViewSchema } from "@/types/proto/api/v1/memo_view_service_pb";
import { useTranslate } from "@/utils/i18n";

const memoViewExamples = [
  {
    title: "Pinned",
    filter: "pinned",
    description: "Only pinned memos.",
    icon: PinIcon,
  },
  {
    title: "Recent notes",
    filter: 'created_ts >= now - duration("1h")',
    description: "Memos created in the last hour.",
    icon: Clock3Icon,
  },
  {
    title: "Public memos",
    filter: 'visibility == "PUBLIC"',
    description: "Only public memos.",
    icon: ShieldIcon,
  },
  {
    title: "Project tags",
    filter: 'tag in ["work", "personal"]',
    description: "Match one or more exact tags.",
    icon: TagsIcon,
  },
  {
    title: "Untagged",
    filter: "size(tags) == 0",
    description: "Memos without any tags.",
    icon: TagsIcon,
  },
  {
    title: "Archive tree",
    filter: 'tags.exists(t, t.startsWith("archive"))',
    description: "Match hierarchical tags by prefix.",
    icon: TagsIcon,
  },
  {
    title: "Unassigned",
    filter: "space == null",
    description: "Memos that are not placed in any space.",
    icon: AstroidIcon,
  },
  {
    title: "In one space",
    filter: 'space == "spaces/your-space-id"',
    description: "Memos placed in a space. Use the space ID from its URL or settings.",
    icon: AstroidIcon,
  },
  {
    title: "Open tasks",
    filter: "has_task_list && has_incomplete_tasks",
    description: "Memos with unfinished tasks.",
    icon: ClipboardCheckIcon,
  },
  {
    title: "Links or code",
    filter: "has_link || has_code",
    description: "Memos containing links or code blocks.",
    icon: FilterIcon,
  },
  {
    title: "No location",
    filter: "!has_location",
    description: "Memos without an attached location.",
    icon: MapPinIcon,
  },
  {
    title: "Content search",
    filter: 'content.contains("TODO")',
    description: "Search text inside memo content.",
    icon: SearchIcon,
  },
  {
    title: "Starts with",
    filter: 'content.startsWith("TODO")',
    description: "Memos whose content begins with text (also endsWith).",
    icon: SearchIcon,
  },
  {
    title: "Regex match",
    filter: 'content.matches("v[0-9]+")',
    description: "Match content with a regular expression.",
    icon: FilterIcon,
  },
  {
    title: "All tags complete",
    filter: 'tags.all(t, t.endsWith("-done"))',
    description: "Every tag ends in -done (tagged memos only).",
    icon: TagsIcon,
  },
  {
    title: "One project tag",
    filter: 'tags.exists_one(t, t.startsWith("project/"))',
    description: "Exactly one tag matches the predicate.",
    icon: TagsIcon,
  },
  {
    title: "Any of these tags",
    filter: 'sets.intersects(tags, ["work", "urgent"])',
    description: "Tags intersect the given set.",
    icon: TagsIcon,
  },
  {
    title: "Exactly these tags",
    filter: 'sets.equivalent(tags, ["inbox"])',
    description: "Tagged with exactly this set, nothing more.",
    icon: TagsIcon,
  },
  {
    title: "Memos from 2024",
    filter: "created_ts.getFullYear() == 2024",
    description: "Filter by calendar year.",
    icon: Clock3Icon,
  },
  {
    title: "Weekend notes",
    filter: "created_ts.getDayOfWeek() == 0 || created_ts.getDayOfWeek() == 6",
    description: "Created on a Sunday or Saturday (0 = Sunday).",
    icon: Clock3Icon,
  },
  {
    title: "Long notes",
    filter: "size(content) > 280",
    description: "Memos longer than 280 characters.",
    icon: FilterIcon,
  },
];

const filterFields = [
  "content.contains(...)",
  "content.startsWith(...)",
  "content.endsWith(...)",
  "content.matches(...)",
  "visibility",
  "pinned",
  "space == null",
  "space != null",
  'space == "spaces/..."',
  "tag in [...]",
  "tags.exists(...)",
  "tags.all(...)",
  "tags.exists_one(...)",
  "sets.contains(tags, [...])",
  "sets.intersects(tags, [...])",
  "sets.equivalent(tags, [...])",
  "size(tags) == ...",
  "size(content) > ...",
  "has_task_list",
  "has_incomplete_tasks",
  "has_link",
  "has_code",
  "has_location",
  'created_ts >= now - duration("24h")',
  "created_ts.getFullYear() == ...",
  "created_ts.getMonth() == ... (0 = Jan)",
  "created_ts.getDayOfWeek() == ... (0 = Sun)",
  "updated_ts",
  "now",
  'timestamp("2025-01-01T00:00:00Z")',
];

const createEmptyMemoView = () =>
  create(MemoViewSchema, {
    name: "",
    title: "",
    filter: "",
  });

interface MemoViewGuideProps {
  onUseExample: (example: (typeof memoViewExamples)[number]) => void;
}

interface MemoViewsRouteState {
  openCreate?: boolean;
  memoView?: MemoView;
}

const MemoViewGuide = ({ onUseExample }: MemoViewGuideProps) => {
  return (
    <aside className="flex flex-col gap-5">
      <div className="rounded-lg border border-border p-4">
        <h2 className="text-sm font-semibold text-foreground">Expression examples</h2>
        <div className="mt-3 flex flex-col gap-2">
          {memoViewExamples.map((example) => {
            const Icon = example.icon;
            return (
              <button
                type="button"
                key={example.filter}
                className="group w-full cursor-pointer rounded-md border border-transparent p-2 text-left transition-colors hover:border-border hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                onClick={() => onUseExample(example)}
              >
                <span className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <Icon className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
                  {example.title}
                </span>
                <span className="mt-1 block font-mono text-xs leading-5 text-muted-foreground">{example.filter}</span>
                <span className="mt-1 block text-xs leading-5 text-muted-foreground">{example.description}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="rounded-lg border border-border p-4">
        <h2 className="text-sm font-semibold text-foreground">Supported fields</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {filterFields.map((field) => (
            <Badge key={field} variant="secondary" className="font-mono">
              {field}
            </Badge>
          ))}
        </div>
      </div>
    </aside>
  );
};

const MemoViews = () => {
  const t = useTranslate();
  const location = useLocation();
  const navigate = useNavigate();
  const user = useCurrentUser();
  const queryClient = useQueryClient();
  const { data: memoViews = [] } = useMemoViews(user?.name);
  const { memoView: selectedMemoView, setMemoView } = useMemoFilterContext();
  const [isCreateFormOpen, setIsCreateFormOpen] = useState(false);
  const [draft, setDraft] = useState<MemoView>(createEmptyMemoView());
  const [deleteTarget, setDeleteTarget] = useState<MemoView | undefined>();
  const createState = useLoading(false);
  const validateState = useLoading(false);
  const updateState = useLoading(false);
  const isEditing = draft.name !== "";
  const isSaving = createState.isLoading || updateState.isLoading;

  useEffect(() => {
    const state = location.state as MemoViewsRouteState | null;
    if (!state) return;

    if (state.memoView) {
      setDraft(
        create(MemoViewSchema, {
          name: state.memoView.name,
          title: state.memoView.title,
          filter: state.memoView.filter,
        }),
      );
      setIsCreateFormOpen(true);
    } else if (state.openCreate) {
      setDraft(createEmptyMemoView());
      setIsCreateFormOpen(true);
    }

    navigate(location.pathname, { replace: true, state: null });
  }, [location.key, location.pathname, location.state, navigate]);

  const setDraftState = (state: Partial<MemoView>) => {
    setDraft((current) => ({ ...current, ...state }));
  };

  const handleUseExample = (example: (typeof memoViewExamples)[number]) => {
    setDraft(
      create(MemoViewSchema, {
        name: draft.name,
        title: draft.title || example.title,
        filter: example.filter,
      }),
    );
    setIsCreateFormOpen(true);
  };

  const handleOpenCreateForm = () => {
    setDraft(createEmptyMemoView());
    setIsCreateFormOpen(true);
  };

  const handleCloseForm = () => {
    setDraft(createEmptyMemoView());
    setIsCreateFormOpen(false);
  };

  const handleEditMemoView = (memoView: MemoView) => {
    setDraft(
      create(MemoViewSchema, {
        name: memoView.name,
        title: memoView.title,
        filter: memoView.filter,
      }),
    );
    setIsCreateFormOpen(true);
  };

  const validateDraft = async () => {
    if (!draft.title || !draft.filter) {
      toast.error("Title and filter cannot be empty");
      return false;
    }
    if (!user?.name) {
      toast.error("No current user");
      return false;
    }

    try {
      validateState.setLoading();
      await memoViewServiceClient.createMemoView({
        parent: user.name,
        memoView: { name: "", title: draft.title, filter: draft.filter },
        validateOnly: true,
      });
      validateState.setFinish();
      toast.success("Filter expression looks valid");
      return true;
    } catch (error: unknown) {
      await handleError(error, toast.error, {
        context: "Validate memo view filter",
        onError: () => validateState.setError(),
      });
      return false;
    }
  };

  const handleCreateMemoView = async () => {
    if (!draft.title || !draft.filter) {
      toast.error("Title and filter cannot be empty");
      return;
    }
    if (!user?.name) {
      toast.error("No current user");
      return;
    }

    try {
      createState.setLoading();
      await memoViewServiceClient.createMemoView({
        parent: user.name,
        memoView: { name: "", title: draft.title, filter: draft.filter },
      });
      await queryClient.invalidateQueries({ queryKey: userKeys.memoViews(user.name) });
      createState.setFinish();
      setDraft(createEmptyMemoView());
      setIsCreateFormOpen(false);
      toast.success("View created successfully");
    } catch (error: unknown) {
      await handleError(error, toast.error, {
        context: "Create memo view",
        onError: () => createState.setError(),
      });
    }
  };

  const handleUpdateMemoView = async () => {
    if (!draft.title || !draft.filter) {
      toast.error("Title and filter cannot be empty");
      return;
    }

    try {
      updateState.setLoading();
      await memoViewServiceClient.updateMemoView({
        memoView: draft,
        updateMask: create(FieldMaskSchema, { paths: ["title", "filter"] }),
      });
      await queryClient.invalidateQueries({ queryKey: userKeys.memoViews(user?.name) });
      updateState.setFinish();
      setDraft(createEmptyMemoView());
      setIsCreateFormOpen(false);
      toast.success("View updated successfully");
    } catch (error: unknown) {
      await handleError(error, toast.error, {
        context: "Update memo view",
        onError: () => updateState.setError(),
      });
    }
  };

  const handleSaveMemoView = async () => {
    if (isEditing) {
      await handleUpdateMemoView();
      return;
    }

    await handleCreateMemoView();
  };

  const confirmDeleteMemoView = async () => {
    if (!deleteTarget) return;

    try {
      await memoViewServiceClient.deleteMemoView({ name: deleteTarget.name });
      await queryClient.invalidateQueries({ queryKey: userKeys.memoViews(user?.name) });
      if (selectedMemoView === getMemoViewId(deleteTarget.name)) setMemoView(undefined);
      toast.success(t("setting.memo-view.delete-success", { title: deleteTarget.title }));
    } catch (error: unknown) {
      await handleError(error, toast.error, {
        context: "Delete memo view",
      });
    } finally {
      setDeleteTarget(undefined);
    }
  };

  return (
    <section className="mx-auto flex w-full max-w-6xl flex-col gap-6 pb-10">
      <div className="flex flex-col gap-2 border-b border-border pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-muted-foreground">
            <FilterIcon className="h-4 w-4" />
            <span className="text-sm font-medium">{t("common.views")}</span>
          </div>
          <h1 className="text-2xl font-semibold tracking-normal text-foreground">Views</h1>
          <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
            Create reusable views with fields, operators, time helpers, and tag matching. Use examples as starting points, then validate
            before saving.
          </p>
        </div>
        <Button onClick={isCreateFormOpen ? handleCloseForm : handleOpenCreateForm}>
          {isCreateFormOpen ? <XIcon className="h-4 w-4" /> : <PlusIcon className="h-4 w-4" />}
          {isCreateFormOpen ? t("common.cancel") : t("common.create")}
        </Button>
      </div>

      <div className={cn("grid grid-cols-1 gap-6", isCreateFormOpen && "xl:grid-cols-[minmax(0,1fr)_20rem]")}>
        <div className="flex min-w-0 flex-col gap-6">
          <div
            className={cn(
              "overflow-hidden rounded-lg border border-border bg-background transition-[max-height,opacity] duration-200",
              isCreateFormOpen ? "max-h-[48rem] opacity-100" : "max-h-0 border-transparent opacity-0",
            )}
          >
            <div className="grid gap-5 p-4 sm:p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold text-foreground">{isEditing ? "Edit view" : "Create view"}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">Name the view and define the memo filter expression it should apply.</p>
                </div>
                <a
                  className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                  href="https://www.usememos.com/docs"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Docs
                  <ExternalLinkIcon className="h-3.5 w-3.5" />
                </a>
              </div>

              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="view-title">{t("common.title")}</Label>
                  <Input
                    id="view-title"
                    value={draft.title}
                    placeholder="Pinned, Recent notes, Work"
                    onChange={(event) => setDraftState({ title: event.target.value })}
                  />
                  <p className="text-xs leading-5 text-muted-foreground">
                    Prefix the title with an emoji if you want it to appear in the sidebar.
                  </p>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="view-filter">{t("common.filter")}</Label>
                  <Textarea
                    id="view-filter"
                    rows={5}
                    className="font-mono text-sm"
                    value={draft.filter}
                    placeholder='pinned && tag in ["work"]'
                    onChange={(event) => setDraftState({ filter: event.target.value })}
                  />
                  <p className="text-xs leading-5 text-muted-foreground">
                    Combine expressions with <span className="font-mono">&&</span>, <span className="font-mono">||</span>, and{" "}
                    <span className="font-mono">!</span>. Time fields are timestamps — use <span className="font-mono">now</span>,{" "}
                    <span className="font-mono">duration("24h")</span>, <span className="font-mono">timestamp(...)</span>, and accessors
                    like <span className="font-mono">created_ts.getFullYear()</span>. Tags support{" "}
                    <span className="font-mono">sets.contains/intersects/equivalent</span> and{" "}
                    <span className="font-mono">size(content)</span> measures length.
                  </p>
                </div>
              </div>

              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button variant="outline" disabled={validateState.isLoading || isSaving} onClick={validateDraft}>
                  <CheckCircle2Icon className="h-4 w-4" />
                  Validate
                </Button>
                <Button disabled={isSaving || validateState.isLoading} onClick={handleSaveMemoView}>
                  <SaveIcon className="h-4 w-4" />
                  {t("common.save")}
                </Button>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-foreground">All views</h2>
              <Badge variant="outline">{memoViews.length}</Badge>
            </div>

            {memoViews.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border px-4 py-10 text-center">
                <p className="text-sm font-medium text-foreground">No views yet</p>
                <p className="mt-1 text-sm text-muted-foreground">Open the create form to choose an example and add your first view.</p>
              </div>
            ) : (
              <div className="divide-y divide-border overflow-hidden rounded-lg border border-border">
                {memoViews.map((memoView) => (
                  <div
                    key={memoView.name}
                    className="grid gap-3 bg-background px-4 py-3 sm:grid-cols-[minmax(10rem,14rem)_minmax(0,1fr)_2rem]"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-foreground">{memoView.title}</div>
                      <div className="mt-1 font-mono text-xs text-muted-foreground">{getMemoViewId(memoView.name)}</div>
                    </div>
                    <pre className="min-w-0 overflow-x-auto rounded-md bg-muted/50 px-3 py-2 font-mono text-xs leading-5 text-muted-foreground">
                      {memoView.filter}
                    </pre>
                    <DropdownMenu>
                      <DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="justify-self-end" />}>
                        <MoreVerticalIcon className="h-4 w-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleEditMemoView(memoView)}>
                          <PencilIcon className="h-4 w-4" />
                          {t("common.edit")}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setDeleteTarget(memoView)}>
                          <Trash2Icon className="h-4 w-4" />
                          {t("common.delete")}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {isCreateFormOpen ? <MemoViewGuide onUseExample={handleUseExample} /> : null}
      </div>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(undefined)}
        title={t("setting.memo-view.delete-confirm", { title: deleteTarget?.title ?? "" })}
        confirmLabel={t("common.delete")}
        cancelLabel={t("common.cancel")}
        onConfirm={confirmDeleteMemoView}
        confirmVariant="destructive"
      />
    </section>
  );
};

export default MemoViews;
