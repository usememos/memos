import { Button } from "@/components/ui/button";
import { useMemoViewContext } from "../MemoViewContext";
import { useCreateMemo, useDeleteMemo, useUpdateMemo } from "@/hooks/useMemoQueries";
import { extractTasks } from "@/utils/markdown-manipulation";
import { toast } from "react-hot-toast";

function MemoCompleteList() {
  const { memo } = useMemoViewContext();
  const { mutate: updateMemo } = useUpdateMemo();
  const { mutate: deleteMemo } = useDeleteMemo();
  const { mutate: createMemo } = useCreateMemo();

  // Parse tasks once per render for both counting and clearing
  const tasks = extractTasks(memo.content);
  const completedTasks = tasks.filter((task) => task.checked);
  const completedCount = completedTasks.length;
  const hasCompletedTasks = completedCount > 0;

  const handleClearCompleted = () => {
    if (!hasCompletedTasks) {
      return;
    }

    const previousContent = memo.content;

    // Remove completed task lines based on the precomputed task list
    const lines = previousContent.split("\n");
    const completedLines = completedTasks
      .map((task) => task.lineNumber)
      .sort((a, b) => b - a);

    for (const lineNumber of completedLines) {
      if (lineNumber >= 0 && lineNumber < lines.length) {
        lines.splice(lineNumber, 1);
      }
    }

    const newContent = lines.join("\n");
    if (newContent === previousContent) {
      return;
    }

    const isNowEmpty = newContent.trim().length === 0;

    if (isNowEmpty) {
      // Delete memo when clearing completed tasks leaves it empty
      deleteMemo(memo.name);

      toast.custom(
        (t) => (
          <div className="flex items-center gap-3 rounded-md border border-border bg-card px-4 py-2 text-sm text-foreground shadow-lg">
            <span>{completedCount} completed items cleared and memo deleted. Undo?</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                // Recreate memo with original content
                createMemo({
                  ...memo,
                  name: "",
                  content: previousContent,
                });
                toast.dismiss(t.id);
              }}
            >
              Undo
            </Button>
          </div>
        ),
        { position: "bottom-center" },
      );
    } else {
      // Just update content when there is still other content
      updateMemo({
        update: {
          name: memo.name,
          content: newContent,
        },
        updateMask: ["content"],
      });

      toast.custom(
        (t) => (
          <div className="flex items-center gap-3 rounded-md border border-border bg-card px-4 py-2 text-sm text-foreground shadow-lg">
            <span>{completedCount} completed items cleared. Undo?</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                updateMemo({
                  update: {
                    name: memo.name,
                    content: previousContent,
                  },
                  updateMask: ["content"],
                });
                toast.dismiss(t.id);
              }}
            >
              Undo
            </Button>
          </div>
        ),
        { position: "bottom-center" },
      );
    }
  };

  return (
    <section className="flex items-center gap-3">
      <Button
        type="button"
        disabled={!hasCompletedTasks}
        onClick={handleClearCompleted}
        className="not-hover:border-foreground not-hover:text-foreground bg-transparent border-2 transition-all ease-linear"
      >
        Clear Completed
      </Button>
    </section>
  );
}

export default MemoCompleteList;