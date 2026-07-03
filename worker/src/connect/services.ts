import type { ConnectRouter } from "@connectrpc/connect";
import type { ServiceContext } from "../services/context";
import { registerAIService } from "../services/ai";
import { registerAttachmentService } from "../services/attachment";
import { registerAuthService } from "../services/auth";
import { registerInstanceService } from "../services/instance";
import { registerMemoService } from "../services/memo";
import { registerShortcutService } from "../services/shortcut";
import { registerUserService } from "../services/user";

// Service registration happens here as services are ported (stages 2-5).
export function registerServices(router: ConnectRouter, ctx: ServiceContext): void {
  registerAuthService(router, ctx);
  registerInstanceService(router, ctx);
  registerUserService(router, ctx);
  registerMemoService(router, ctx);
  registerShortcutService(router, ctx);
  registerAttachmentService(router, ctx);
  registerAIService(router, ctx);
}
