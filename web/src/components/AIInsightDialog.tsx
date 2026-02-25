import { create } from "@bufbuild/protobuf";
import { LoaderIcon, RefreshCwIcon, SparklesIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { memoServiceClient } from "@/connect";
import { handleError } from "@/lib/error";
import { GenerateInsightRequestSchema } from "@/types/proto/api/v1/memo_service_pb";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  memoNames: string[];
}

function AIInsightDialog({ open, onOpenChange, memoNames }: Props) {
  const [insight, setInsight] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (open && memoNames.length > 0) {
      generateInsight();
    }
  }, [open]);

  const generateInsight = async () => {
    setIsLoading(true);
    setInsight("");
    try {
      const response = await memoServiceClient.generateInsight(create(GenerateInsightRequestSchema, { memoNames }));
      setInsight(response.insight);
    } catch (error: unknown) {
      await handleError(error, toast.error, { context: "Generate insight" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <SparklesIcon className="w-5 h-5 text-amber-500" />
            AI Insight
          </DialogTitle>
          <DialogDescription>Deep analysis of your memos to reveal patterns and spark new thinking.</DialogDescription>
        </DialogHeader>

        <div className="min-h-[200px]">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <LoaderIcon className="w-8 h-8 text-amber-500 animate-spin" />
              <p className="text-sm text-muted-foreground">Analyzing your memos...</p>
            </div>
          ) : insight ? (
            <div className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">{insight}</div>
          ) : null}
        </div>

        {!isLoading && insight && (
          <div className="flex justify-end">
            <Button variant="outline" onClick={generateInsight} className="gap-2">
              <RefreshCwIcon className="w-4 h-4" />
              Regenerate
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default AIInsightDialog;
