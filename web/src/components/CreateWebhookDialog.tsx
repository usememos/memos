import React, { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { userServiceClient } from "@/grpcweb";
import useCurrentUser from "@/hooks/useCurrentUser";
import useLoading from "@/hooks/useLoading";
import { useTranslate } from "@/utils/i18n";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  webhookName?: string;
  onSuccess?: () => void;
}

interface State {
  displayName: string;
  url: string;
  type: "RAW" | "WECOM" | "BARK";
}

function CreateWebhookDialog({ open, onOpenChange, webhookName, onSuccess }: Props) {
  const t = useTranslate();
  const currentUser = useCurrentUser();
  const [state, setState] = useState<State>({
    displayName: "",
    url: "",
    type: "RAW",
  });
  const requestState = useLoading(false);
  const isCreating = webhookName === undefined;

  useEffect(() => {
    if (webhookName && currentUser) {
      // For editing, we need to get the webhook data
      // Since we're using user webhooks now, we need to list all webhooks and find the one we want
      userServiceClient
        .listUserWebhooks({
          parent: currentUser.name,
        })
        .then((response) => {
          const webhook = response.webhooks.find((w) => w.name === webhookName);
          if (webhook) {
            const { type, rawUrl } = deriveTypeAndUrl(webhook.url);
            setState({
              displayName: webhook.displayName,
              url: rawUrl,
              type,
            });
          }
        });
    }
  }, [webhookName, currentUser]);

  const setPartialState = (partialState: Partial<State>) => {
    setState({
      ...state,
      ...partialState,
    });
  };

  const handleTitleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPartialState({
      displayName: e.target.value,
    });
  };

  const handleUrlInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPartialState({
      url: e.target.value,
    });
  };

  const handleSaveBtnClick = async () => {
    if (!state.displayName || !state.url) {
      toast.error(t("message.fill-all-required-fields"));
      return;
    }

    if (!currentUser) {
      toast.error("User not authenticated");
      return;
    }

    try {
      requestState.setLoading();
      // 根据类型构造存储的 URL。兼容短期方案：为 WeCom/Bark 显式添加自定义前缀，后端将解析并派发。
      const urlForStore = buildUrlForStore(state.type, state.url);

      if (isCreating) {
        await userServiceClient.createUserWebhook({
          parent: currentUser.name,
          webhook: {
            displayName: state.displayName,
            url: urlForStore,
          },
        });
      } else {
        await userServiceClient.updateUserWebhook({
          webhook: {
            name: webhookName,
            displayName: state.displayName,
            url: urlForStore,
          },
          updateMask: ["display_name", "url"],
        });
      }

      onSuccess?.();
      onOpenChange(false);
      requestState.setFinish();
    } catch (error: any) {
      console.error(error);
      toast.error(error.details);
      requestState.setError();
    }
  };

  const handleCopyTest = async () => {
    // 复制一条示例 curl，方便用户测试。
    const sample = buildTestCommand(state.type, state.url, state.displayName);
    try {
      await navigator.clipboard.writeText(sample);
      toast.success(t("common.copied") ?? "Copied");
    } catch {
      toast.error("Failed to copy test command");
    }
  };

  const deriveTypeAndUrl = (storedUrl: string): { type: State["type"]; rawUrl: string } => {
    if (storedUrl.startsWith("wecom://")) {
      return { type: "WECOM", rawUrl: storedUrl.replace(/^wecom:\/\//, "") };
    }
    if (storedUrl.startsWith("bark://")) {
      return { type: "BARK", rawUrl: storedUrl.replace(/^bark:\/\//, "") };
    }
    return { type: "RAW", rawUrl: storedUrl };
  };

  const buildUrlForStore = (type: State["type"], rawUrl: string) => {
    const u = rawUrl.trim();
    if (type === "WECOM") return `wecom://${u}`;
    if (type === "BARK") return `bark://${u}`;
    return u;
  };

  const buildTestCommand = (type: State["type"], rawUrl: string, name: string) => {
    if (type === "WECOM") {
      // 企业微信机器人文本消息示例
      const real = rawUrl.trim();
      const content = `Test from Memos webhook: ${name}`;
      return `curl -X POST -H "Content-Type: application/json" -d '{"msgtype":"text","text":{"content":"${content}"}}' "${real}"`;
    }
    if (type === "BARK") {
      const base = rawUrl.trim().replace(/\/$/, "");
      return `curl "${base}/Test%20from%20Memos/${encodeURIComponent(name)}"`;
    }
    // RAW：示例发送通用 JSON。
    const real = rawUrl.trim();
    return `curl -X POST -H "Content-Type: application/json" -d '{"activityType":"memos.memo.test","creator":"users/1","memo":{}}' "${real}"`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isCreating
              ? t("setting.webhook-section.create-dialog.create-webhook")
              : t("setting.webhook-section.create-dialog.edit-webhook")}
          </DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="grid gap-2">
            <Label htmlFor="type">{t("common.type")}</Label>
            <Select value={state.type} onValueChange={(val) => setPartialState({ type: val as State["type"] })}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="RAW">RAW</SelectItem>
                <SelectItem value="WECOM">WeCom</SelectItem>
                <SelectItem value="BARK">Bark</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="displayName">
              {t("setting.webhook-section.create-dialog.title")} <span className="text-destructive">*</span>
            </Label>
            <Input
              id="displayName"
              type="text"
              placeholder={t("setting.webhook-section.create-dialog.an-easy-to-remember-name")}
              value={state.displayName}
              onChange={handleTitleInputChange}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="url">
              {t("setting.webhook-section.create-dialog.payload-url")} <span className="text-destructive">*</span>
            </Label>
            <Input
              id="url"
              type="text"
              placeholder={t("setting.webhook-section.create-dialog.url-example-post-receive")}
              value={state.url}
              onChange={handleUrlInputChange}
            />
            <p className="text-xs text-muted-foreground">
              {state.type === "RAW"
                ? "RAW：你的服务需接收通用 JSON。"
                : state.type === "WECOM"
                ? "企业微信：请输入机器人完整链接，例如 https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=..."
                : "Bark：请输入 https://api.day.app/{key} 或自建 bark-server 根地址"}
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" disabled={requestState.isLoading} onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          <Button variant="outline" disabled={!state.url} onClick={handleCopyTest}>
            测试示例 curl
          </Button>
          <Button disabled={requestState.isLoading} onClick={handleSaveBtnClick}>
            {t("common.create")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default CreateWebhookDialog;
