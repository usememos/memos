import { create } from "@bufbuild/protobuf";
import { FieldMaskSchema } from "@bufbuild/protobuf/wkt";
import { useQueryClient } from "@tanstack/react-query";
import { Badge, Button, Field, Input, Menu, Textarea, Tooltip } from "@usememos/ui";
import {
  AstroidIcon,
  CheckCircle2Icon,
  ClipboardCheckIcon,
  Clock3Icon,
  ExternalLinkIcon,
  FilterIcon,
  ImageIcon,
  type LucideIcon,
  MapPinIcon,
  MoreVerticalIcon,
  PaperclipIcon,
  ParenthesesIcon,
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
import { useLocation, useNavigate } from "react-router-dom";
import ConfirmDialog from "@/components/ConfirmDialog";
import CustomIconPicker from "@/components/CustomIconPicker";
import MemoViewIcon from "@/components/MemoViewIcon";
import { userServiceClient } from "@/connect";
import { useMemoFilterContext } from "@/contexts/MemoFilterContext";
import useCurrentUser from "@/hooks/useCurrentUser";
import useLoading from "@/hooks/useLoading";
import { useMemoViews, userKeys } from "@/hooks/useUserQueries";
import { handleError } from "@/lib/error";
import { getMemoViewId } from "@/lib/memo-views";
import { showErrorToast, toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { MemoView, MemoView_IconSchema, MemoViewSchema } from "@/types/proto/api/user_service_pb";
import { type Translations, useTranslate } from "@/utils/i18n";

const memoViewExamples: { titleKey: Translations; filter: string; descriptionKey: Translations; icon: LucideIcon }[] = [
  {
    titleKey: "setting.memo-view.examples.pinned.title",
    filter: "pinned",
    descriptionKey: "setting.memo-view.examples.pinned.description",
    icon: PinIcon,
  },
  {
    titleKey: "setting.memo-view.examples.recent.title",
    filter: 'created_ts >= now - duration("1h")',
    descriptionKey: "setting.memo-view.examples.recent.description",
    icon: Clock3Icon,
  },
  {
    titleKey: "setting.memo-view.examples.public.title",
    filter: 'visibility == "PUBLIC"',
    descriptionKey: "setting.memo-view.examples.public.description",
    icon: ShieldIcon,
  },
  {
    titleKey: "setting.memo-view.examples.project-tags.title",
    filter: 'tag in ["work", "personal"]',
    descriptionKey: "setting.memo-view.examples.project-tags.description",
    icon: TagsIcon,
  },
  {
    titleKey: "setting.memo-view.examples.untagged.title",
    filter: "size(tags) == 0",
    descriptionKey: "setting.memo-view.examples.untagged.description",
    icon: TagsIcon,
  },
  {
    titleKey: "setting.memo-view.examples.archive-tree.title",
    filter: 'tags.exists(t, t.startsWith("archive"))',
    descriptionKey: "setting.memo-view.examples.archive-tree.description",
    icon: TagsIcon,
  },
  {
    titleKey: "setting.memo-view.examples.unassigned.title",
    filter: "space == null",
    descriptionKey: "setting.memo-view.examples.unassigned.description",
    icon: AstroidIcon,
  },
  {
    titleKey: "setting.memo-view.examples.one-space.title",
    filter: 'space == "spaces/your-space-id"',
    descriptionKey: "setting.memo-view.examples.one-space.description",
    icon: AstroidIcon,
  },
  {
    titleKey: "setting.memo-view.examples.open-tasks.title",
    filter: "has_task_list && has_incomplete_tasks",
    descriptionKey: "setting.memo-view.examples.open-tasks.description",
    icon: ClipboardCheckIcon,
  },
  {
    titleKey: "setting.memo-view.examples.links-or-code.title",
    filter: "has_link || has_code",
    descriptionKey: "setting.memo-view.examples.links-or-code.description",
    icon: FilterIcon,
  },
  {
    titleKey: "setting.memo-view.examples.no-location.title",
    filter: "!has_location",
    descriptionKey: "setting.memo-view.examples.no-location.description",
    icon: MapPinIcon,
  },
  {
    titleKey: "setting.memo-view.examples.with-attachments.title",
    filter: "has_attachments",
    descriptionKey: "setting.memo-view.examples.with-attachments.description",
    icon: PaperclipIcon,
  },
  {
    titleKey: "setting.memo-view.examples.photos.title",
    filter: "has_image",
    descriptionKey: "setting.memo-view.examples.photos.description",
    icon: ImageIcon,
  },
  {
    titleKey: "setting.memo-view.examples.content-search.title",
    filter: 'content.contains("TODO")',
    descriptionKey: "setting.memo-view.examples.content-search.description",
    icon: SearchIcon,
  },
  {
    titleKey: "setting.memo-view.examples.starts-with.title",
    filter: 'content.startsWith("TODO")',
    descriptionKey: "setting.memo-view.examples.starts-with.description",
    icon: SearchIcon,
  },
  {
    titleKey: "setting.memo-view.examples.regex.title",
    filter: 'content.matches("v[0-9]+")',
    descriptionKey: "setting.memo-view.examples.regex.description",
    icon: FilterIcon,
  },
  {
    titleKey: "setting.memo-view.examples.all-tags-complete.title",
    filter: 'tags.all(t, t.endsWith("-done"))',
    descriptionKey: "setting.memo-view.examples.all-tags-complete.description",
    icon: TagsIcon,
  },
  {
    titleKey: "setting.memo-view.examples.one-project-tag.title",
    filter: 'tags.exists_one(t, t.startsWith("project/"))',
    descriptionKey: "setting.memo-view.examples.one-project-tag.description",
    icon: TagsIcon,
  },
  {
    titleKey: "setting.memo-view.examples.any-tags.title",
    filter: 'sets.intersects(tags, ["work", "urgent"])',
    descriptionKey: "setting.memo-view.examples.any-tags.description",
    icon: TagsIcon,
  },
  {
    titleKey: "setting.memo-view.examples.exact-tags.title",
    filter: 'sets.equivalent(tags, ["inbox"])',
    descriptionKey: "setting.memo-view.examples.exact-tags.description",
    icon: TagsIcon,
  },
  {
    titleKey: "setting.memo-view.examples.year-2024.title",
    filter: "created_ts.getFullYear() == 2024",
    descriptionKey: "setting.memo-view.examples.year-2024.description",
    icon: Clock3Icon,
  },
  {
    titleKey: "setting.memo-view.examples.weekend.title",
    filter: "created_ts.getDayOfWeek() == 0 || created_ts.getDayOfWeek() == 6",
    descriptionKey: "setting.memo-view.examples.weekend.description",
    icon: Clock3Icon,
  },
  {
    titleKey: "setting.memo-view.examples.long.title",
    filter: "size(content) > 280",
    descriptionKey: "setting.memo-view.examples.long.description",
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
  "has_attachments",
  "has_image",
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

// Code snippets in the filter help; the translated sentence places each one, drawn in monospace.
const FILTER_HELP_CODE: Record<string, string> = {
  and: "&&",
  or: "||",
  not: "!",
  now: "now",
  duration: 'duration("24h")',
  timestamp: "timestamp(...)",
  year: "created_ts.getFullYear()",
  sets: "sets.contains/intersects/equivalent",
  size: "size(content)",
};

const FilterHelp = () => {
  const t = useTranslate();
  const marker = "\u0000";
  const text = t(
    "setting.memo-view.filter-help",
    Object.fromEntries(Object.keys(FILTER_HELP_CODE).map((name) => [name, `${marker}${name}${marker}`])),
  );
  return text.split(marker).map((part, index) =>
    index % 2 === 1 ? (
      <span key={part} className="font-mono">
        {FILTER_HELP_CODE[part]}
      </span>
    ) : (
      part
    ),
  );
};

const MemoViewGuide = ({ onUseExample }: MemoViewGuideProps) => {
  const t = useTranslate();
  return (
    <aside className="flex flex-col gap-5">
      <div className="rounded-mu-lg border border-mu-line p-4">
        <h2 className="mu-label text-mu-ink">{t("setting.memo-view.examples-title")}</h2>
        <div className="mt-3 flex flex-col gap-2">
          {memoViewExamples.map((example) => {
            const Icon = example.icon;
            return (
              <button
                type="button"
                key={example.filter}
                className="group w-full cursor-pointer rounded-mu-md border border-transparent p-2 text-left transition-colors hover:border-mu-line hover:bg-mu-hover mu-focus"
                onClick={() => onUseExample(example)}
              >
                <span className="flex items-center gap-2 mu-label text-mu-ink">
                  <Icon className="mu-icon text-mu-ink-muted group-hover:text-mu-primary" />
                  {t(example.titleKey)}
                </span>
                <span className="mt-1 block font-mono mu-caption text-mu-ink-muted">{example.filter}</span>
                <span className="mt-1 block mu-caption text-mu-ink-muted">{t(example.descriptionKey)}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="rounded-mu-lg border border-mu-line p-4">
        <h2 className="mu-label text-mu-ink">{t("setting.memo-view.fields-title")}</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {filterFields.map((field) => (
            <Badge key={field} className="font-mono">
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
  const { data: memoViews = [], isPending, isError, refetch } = useMemoViews(user?.name);
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
          icon: state.memoView.icon,
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
        title: draft.title || t(example.titleKey),
        filter: example.filter,
        icon: draft.icon,
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
        icon: memoView.icon,
      }),
    );
    setIsCreateFormOpen(true);
  };

  const validateDraft = async () => {
    if (!draft.title || !draft.filter) {
      showErrorToast(t("setting.memo-view.title-filter-required"));
      return false;
    }
    if (!user?.name) {
      showErrorToast(t("message.not-signed-in"));
      return false;
    }

    try {
      validateState.setLoading();
      await userServiceClient.createMemoView({
        parent: user.name,
        memoView: { name: "", title: draft.title, filter: draft.filter, icon: draft.icon },
        validateOnly: true,
      });
      validateState.setFinish();
      toast.add({ title: t("setting.memo-view.filter-valid"), type: "success" });
      return true;
    } catch (error: unknown) {
      await handleError(error, showErrorToast, {
        context: "Validate memo view filter",
        onError: () => validateState.setError(),
      });
      return false;
    }
  };

  const handleCreateMemoView = async () => {
    if (!draft.title || !draft.filter) {
      showErrorToast(t("setting.memo-view.title-filter-required"));
      return;
    }
    if (!user?.name) {
      showErrorToast(t("message.not-signed-in"));
      return;
    }

    try {
      createState.setLoading();
      await userServiceClient.createMemoView({
        parent: user.name,
        memoView: { name: "", title: draft.title, filter: draft.filter, icon: draft.icon },
      });
      await queryClient.invalidateQueries({ queryKey: userKeys.memoViews(user.name) });
      createState.setFinish();
      setDraft(createEmptyMemoView());
      setIsCreateFormOpen(false);
      toast.add({ title: t("setting.memo-view.create-success"), type: "success" });
    } catch (error: unknown) {
      await handleError(error, showErrorToast, {
        context: "Create memo view",
        onError: () => createState.setError(),
      });
    }
  };

  const handleUpdateMemoView = async () => {
    if (!draft.title || !draft.filter) {
      showErrorToast(t("setting.memo-view.title-filter-required"));
      return;
    }

    try {
      updateState.setLoading();
      await userServiceClient.updateMemoView({
        memoView: draft,
        updateMask: create(FieldMaskSchema, { paths: ["title", "filter", "icon"] }),
      });
      await queryClient.invalidateQueries({ queryKey: userKeys.memoViews(user?.name) });
      updateState.setFinish();
      setDraft(createEmptyMemoView());
      setIsCreateFormOpen(false);
      toast.add({ title: t("setting.memo-view.update-success"), type: "success" });
    } catch (error: unknown) {
      await handleError(error, showErrorToast, {
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
      await userServiceClient.deleteMemoView({ name: deleteTarget.name });
      await queryClient.invalidateQueries({ queryKey: userKeys.memoViews(user?.name) });
      if (selectedMemoView === getMemoViewId(deleteTarget.name)) setMemoView(undefined);
      toast.add({ title: t("setting.memo-view.delete-success", { title: deleteTarget.title }), type: "success" });
    } catch (error: unknown) {
      await handleError(error, showErrorToast, {
        context: "Delete memo view",
      });
    } finally {
      setDeleteTarget(undefined);
    }
  };

  return (
    <section className="mx-auto flex w-full max-w-6xl flex-col gap-6 pb-10">
      <div className="flex flex-col gap-2 border-b border-mu-line pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-mu-ink-muted">
            <FilterIcon className="mu-icon" />
            <span className="mu-label">{t("common.views")}</span>
          </div>
          <h1 className="mu-heading tracking-normal text-mu-ink">{t("common.views")}</h1>
          <p className="max-w-2xl mu-body text-mu-ink-muted">{t("setting.memo-view.page-description")}</p>
        </div>
        <Button
          variant="neutral"
          onClick={isCreateFormOpen ? handleCloseForm : handleOpenCreateForm}
          icon={isCreateFormOpen ? <XIcon /> : <PlusIcon />}
        >
          {isCreateFormOpen ? t("common.cancel") : t("common.create")}
        </Button>
      </div>

      <div className={cn("grid grid-cols-1 gap-6", isCreateFormOpen && "xl:grid-cols-[minmax(0,1fr)_20rem]")}>
        <div className="flex min-w-0 flex-col gap-6">
          <div
            inert={!isCreateFormOpen}
            className={cn(
              "overflow-hidden rounded-mu-lg border border-mu-line bg-mu-canvas transition-[max-height,opacity] duration-200",
              isCreateFormOpen ? "max-h-[48rem] opacity-100" : "max-h-0 border-transparent opacity-0",
            )}
          >
            <div className="grid gap-5 p-4 sm:p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="mu-label text-mu-ink">{isEditing ? t("setting.memo-view.edit") : t("setting.memo-view.create")}</h2>
                  <p className="mt-1 mu-body text-mu-ink-muted">{t("setting.memo-view.form-description")}</p>
                </div>
                <a
                  className="inline-flex items-center gap-1 mu-label text-mu-accent hover:underline"
                  href="https://www.usememos.com/docs"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {t("common.docs")}
                  <ExternalLinkIcon className="mu-icon-sm" />
                </a>
              </div>

              <div className="grid gap-4">
                <div className="flex flex-col gap-1">
                  <label htmlFor="view-title" className="mu-label">
                    {t("common.title")}
                  </label>
                  <div className="flex items-center gap-2">
                    <CustomIconPicker
                      value={draft.icon}
                      onChange={(icon) => setDraftState({ icon: icon ? create(MemoView_IconSchema, icon) : undefined })}
                      label={t("setting.memo-view.change-icon")}
                      fallback={ParenthesesIcon}
                      disabled={isSaving}
                    />
                    <Input
                      id="view-title"
                      value={draft.title}
                      placeholder={t("setting.memo-view.title-placeholder")}
                      onChange={(event) => setDraftState({ title: event.target.value })}
                    />
                  </div>
                </div>
                <Field.Root>
                  <Field.Label>{t("common.filter")}</Field.Label>
                  <Textarea
                    id="view-filter"
                    rows={5}
                    className="font-mono"
                    value={draft.filter}
                    placeholder='pinned && tag in ["work"]'
                    onChange={(event) => setDraftState({ filter: event.target.value })}
                  />
                  <Field.Description>
                    <FilterHelp />
                  </Field.Description>
                </Field.Root>
              </div>

              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button
                  variant="neutral"
                  disabled={validateState.isLoading || isSaving}
                  onClick={validateDraft}
                  icon={<CheckCircle2Icon />}
                >
                  {t("setting.memo-view.validate")}
                </Button>
                <Button variant="primary" disabled={isSaving || validateState.isLoading} onClick={handleSaveMemoView} icon={<SaveIcon />}>
                  {t("common.save")}
                </Button>
              </div>
            </div>
          </div>

          {!(memoViews.length === 0 && isCreateFormOpen) && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <h2 className="mu-label text-mu-ink">{t("setting.memo-view.all")}</h2>
                {!isPending && !isError && <Badge tone="outline">{memoViews.length}</Badge>}
              </div>

              {isPending ? (
                <p className="py-10 text-center mu-body text-mu-ink-muted">{t("setting.memo-view.loading")}</p>
              ) : isError ? (
                <div className="py-10 text-center">
                  <p className="mu-body text-mu-ink-muted">{t("setting.memo-view.load-failed")}</p>
                  <Button variant="neutral" className="mt-4" onClick={() => void refetch()}>
                    {t("common.retry")}
                  </Button>
                </div>
              ) : memoViews.length === 0 ? (
                <div className="rounded-mu-lg border border-dashed border-mu-line px-4 py-10 text-center">
                  <p className="mu-label text-mu-ink">{t("setting.memo-view.empty-title")}</p>
                  <p className="mt-1 mu-body text-mu-ink-muted">{t("setting.memo-view.empty-description")}</p>
                  <Button variant="neutral" className="mt-4" onClick={handleOpenCreateForm} icon={<PlusIcon />}>
                    {t("setting.memo-view.create")}
                  </Button>
                </div>
              ) : (
                <div className="divide-y divide-mu-line overflow-hidden rounded-mu-lg border border-mu-line">
                  {memoViews.map((memoView) => (
                    <div
                      key={memoView.name}
                      className="grid gap-3 bg-mu-canvas px-4 py-3 sm:grid-cols-[minmax(10rem,14rem)_minmax(0,1fr)_2rem]"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mu-label text-mu-ink">
                          <MemoViewIcon icon={memoView.icon} className="text-base" />
                          <span className="truncate">{memoView.title}</span>
                        </div>
                        <div className="mt-1 font-mono mu-caption text-mu-ink-muted">{getMemoViewId(memoView.name)}</div>
                      </div>
                      <pre className="min-w-0 overflow-x-auto rounded-mu-md bg-mu-well/50 px-3 py-2 font-mono mu-caption text-mu-ink-muted">
                        {memoView.filter}
                      </pre>
                      <Menu.Root modal={false}>
                        <Tooltip.Root>
                          <Tooltip.Trigger
                            render={
                              <Menu.Trigger
                                render={
                                  <Button
                                    variant="ghost"
                                    className="justify-self-end"
                                    aria-label={`${t("common.more")}: ${memoView.title}`}
                                    icon={<MoreVerticalIcon />}
                                  />
                                }
                              />
                            }
                          />
                          <Tooltip.Popup>{t("common.more")}</Tooltip.Popup>
                        </Tooltip.Root>
                        <Menu.Popup align="end">
                          <Menu.Item onClick={() => handleEditMemoView(memoView)} icon={<PencilIcon />}>
                            {t("common.edit")}
                          </Menu.Item>
                          <Menu.Item onClick={() => setDeleteTarget(memoView)} icon={<Trash2Icon />}>
                            {t("common.delete")}
                          </Menu.Item>
                        </Menu.Popup>
                      </Menu.Root>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
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
        confirmVariant="danger"
      />
    </section>
  );
};

export default MemoViews;
