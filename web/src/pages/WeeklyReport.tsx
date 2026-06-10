import { timestampDate } from "@bufbuild/protobuf/wkt";
import { DownloadIcon, RefreshCwIcon } from "lucide-react";
import { useMemo, useState } from "react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { buildMemoCreatorFilter } from "@/helpers/resource-names";
import useCurrentUser from "@/hooks/useCurrentUser";
import { useInfiniteMemos } from "@/hooks/useMemoQueries";
import { State } from "@/types/proto/api/v1/common_pb";
import type { Memo } from "@/types/proto/api/v1/memo_service_pb";

type RangePreset = "this-week" | "last-week" | "custom";

const formatDateInput = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const startOfLocalDay = (date: Date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

const addDays = (date: Date, days: number) => {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
};

const getThisWeekRange = () => {
  const today = startOfLocalDay(new Date());
  const day = today.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const start = addDays(today, mondayOffset);
  const end = addDays(start, 7);

  return { start, end };
};

const getLastWeekRange = () => {
  const thisWeek = getThisWeekRange();
  const start = addDays(thisWeek.start, -7);
  const end = thisWeek.start;

  return { start, end };
};

const parseTagInput = (value: string) => {
  return value
    .split(/[，,\s]+/)
    .map((tag) => tag.trim().replace(/^#/, ""))
    .filter(Boolean);
};

const stripMarkdown = (content: string) => {
  return content
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[`*_>#-]/g, "")
    .replace(/\s+/g, " ")
    .trim();
};

const getMemoDate = (memo: Memo) => {
  return memo.createTime ? timestampDate(memo.createTime) : new Date();
};

const toEpochSeconds = (date: Date) => Math.floor(date.getTime() / 1000);

const buildMemoFilter = (creatorName: string | undefined, startDate: string, endDate: string, tags: string[]) => {
  const start = new Date(`${startDate}T00:00:00`);
  const end = addDays(new Date(`${endDate}T00:00:00`), 1);
  const conditions = [`created_ts >= ${toEpochSeconds(start)}`, `created_ts < ${toEpochSeconds(end)}`];

  const creatorFilter = creatorName ? buildMemoCreatorFilter(creatorName) : undefined;
  if (creatorFilter) {
    conditions.unshift(creatorFilter);
  }

  if (tags.length > 0) {
    const tagFilter = tags.map((tag) => `tag in [${JSON.stringify(tag)}]`).join(" || ");
    conditions.push(`(${tagFilter})`);
  }

  return conditions.join(" && ");
};

const generateReport = (memos: Memo[], startDate: string, endDate: string, selectedTags: string[]) => {
  const sortedMemos = [...memos].sort((a, b) => getMemoDate(a).getTime() - getMemoDate(b).getTime());
  const allTags = Array.from(new Set(sortedMemos.flatMap((memo) => memo.tags))).sort();

  const grouped = sortedMemos.reduce<Record<string, Memo[]>>((result, memo) => {
    const date = getMemoDate(memo).toLocaleDateString("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });

    result[date] = result[date] || [];
    result[date].push(memo);
    return result;
  }, {});

  const lines: string[] = [];

  lines.push(`# 周报汇总：${startDate} 至 ${endDate}`);
  lines.push("");
  lines.push(`- 生成时间：${new Date().toLocaleString("zh-CN")}`);
  lines.push(`- 记录数量：${sortedMemos.length} 条`);
  lines.push(`- 筛选标签：${selectedTags.length > 0 ? selectedTags.map((tag) => `#${tag}`).join("、") : "全部标签"}`);
  lines.push(`- 涉及标签：${allTags.length > 0 ? allTags.map((tag) => `#${tag}`).join("、") : "无"}`);
  lines.push("");
  lines.push("## 一、汇总概览");
  lines.push("");

  if (sortedMemos.length === 0) {
    lines.push("本时间范围内没有符合条件的 memo。");
  } else {
    lines.push(`本时间范围内共整理 ${sortedMemos.length} 条 memo，可用于回顾本周学习、工作、部署、问题记录和后续计划。`);
  }

  lines.push("");
  lines.push("## 二、按日期整理");
  lines.push("");

  for (const [date, dayMemos] of Object.entries(grouped)) {
    lines.push(`### ${date}`);

    for (const memo of dayMemos) {
      const time = getMemoDate(memo).toLocaleTimeString("zh-CN", {
        hour: "2-digit",
        minute: "2-digit",
      });
      const text = stripMarkdown(memo.content) || "空内容";
      lines.push(`- ${time}：${text}`);
    }

    lines.push("");
  }

  lines.push("## 三、后续计划");
  lines.push("");
  lines.push("- 根据本周记录，继续跟进未完成事项。");
  lines.push("- 对高频标签内容进行复盘，提炼可沉淀的经验。");
  lines.push("");
  lines.push("## 四、原始 Memo");
  lines.push("");

  for (const memo of sortedMemos) {
    const date = getMemoDate(memo).toLocaleString("zh-CN");
    lines.push(`### ${date}`);
    lines.push("");
    lines.push(memo.content || "空内容");
    lines.push("");
  }

  return lines.join("\n");
};

const WeeklyReport = () => {
  const currentUser = useCurrentUser();
  const thisWeek = useMemo(() => getThisWeekRange(), []);
  const [preset, setPreset] = useState<RangePreset>("this-week");
  const [startDate, setStartDate] = useState(formatDateInput(thisWeek.start));
  const [endDate, setEndDate] = useState(formatDateInput(addDays(thisWeek.end, -1)));
  const [tagInput, setTagInput] = useState("");

  const selectedTags = useMemo(() => parseTagInput(tagInput), [tagInput]);

  const filter = useMemo(
    () => buildMemoFilter(currentUser?.name, startDate, endDate, selectedTags),
    [currentUser?.name, startDate, endDate, selectedTags],
  );

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading, refetch } = useInfiniteMemos({
    state: State.NORMAL,
    orderBy: "create_time asc",
    filter,
    pageSize: 100,
  });

  const memos = useMemo(() => data?.pages.flatMap((page) => page.memos) || [], [data]);

  const report = useMemo(() => generateReport(memos, startDate, endDate, selectedTags), [memos, startDate, endDate, selectedTags]);

  const handlePresetChange = (value: RangePreset) => {
    setPreset(value);

    if (value === "this-week") {
      const range = getThisWeekRange();
      setStartDate(formatDateInput(range.start));
      setEndDate(formatDateInput(addDays(range.end, -1)));
    } else if (value === "last-week") {
      const range = getLastWeekRange();
      setStartDate(formatDateInput(range.start));
      setEndDate(formatDateInput(addDays(range.end, -1)));
    }
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(report);
    toast.success("周报已复制到剪贴板");
  };

  const handleDownload = () => {
    const blob = new Blob([report], {
      type: "text/markdown;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `weekly-report-${startDate}-${endDate}.md`;
    link.click();

    URL.revokeObjectURL(url);
  };

  return (
    <div className="w-full max-w-5xl mx-auto space-y-4">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">周报 / 汇总导出</h1>
        <p className="text-sm text-muted-foreground">按时间范围和标签筛选 memos，生成 Markdown 周报，可复制或导出。</p>
      </div>

      <div className="rounded-xl border bg-card p-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="space-y-1">
            <label className="text-sm font-medium">时间范围</label>
            <Select value={preset} onValueChange={(value) => handlePresetChange(value as RangePreset)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="this-week">本周</SelectItem>
                <SelectItem value="last-week">上周</SelectItem>
                <SelectItem value="custom">自定义</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">开始日期</label>
            <Input
              type="date"
              value={startDate}
              onChange={(event) => {
                setPreset("custom");
                setStartDate(event.target.value);
              }}
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">结束日期</label>
            <Input
              type="date"
              value={endDate}
              onChange={(event) => {
                setPreset("custom");
                setEndDate(event.target.value);
              }}
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">标签，可选</label>
            <Input value={tagInput} onChange={(event) => setTagInput(event.target.value)} placeholder="#deploy, #study" />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={() => refetch()} disabled={isLoading}>
            <RefreshCwIcon className="w-4 h-4" />
            重新生成
          </Button>

          {hasNextPage && (
            <Button variant="outline" onClick={() => fetchNextPage()} disabled={isFetchingNextPage}>
              {isFetchingNextPage ? "加载中..." : "加载更多 memo"}
            </Button>
          )}

          <Button onClick={handleCopy} disabled={isLoading}>
            复制为文本
          </Button>

          <Button variant="secondary" onClick={handleDownload} disabled={isLoading}>
            <DownloadIcon className="w-4 h-4" />
            导出 Markdown
          </Button>

          <span className="text-sm text-muted-foreground">当前已汇总 {memos.length} 条 memo</span>
        </div>
      </div>

      <div className="rounded-xl border bg-card p-4 space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium">周报预览</h2>
          {isLoading && <span className="text-sm text-muted-foreground">正在加载...</span>}
        </div>

        <Textarea className="min-h-[520px] font-mono text-sm" value={report} readOnly />
      </div>
    </div>
  );
};

export default WeeklyReport;