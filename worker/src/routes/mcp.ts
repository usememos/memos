// Stateless MCP server (Streamable HTTP transport, JSON responses) exposing a
// curated subset of the API as tools — port of server/router/mcp. Tool calls
// are dispatched in-process through a Connect router transport.
import { create, fromJson, toJson, type DescField, type DescMessage, type DescMethod, type DescService } from "@bufbuild/protobuf";
import { createRouterTransport, ConnectError } from "@connectrpc/connect";
import { AuthService } from "../gen/api/v1/auth_service_pb";
import { AttachmentService } from "../gen/api/v1/attachment_service_pb";
import { MemoService } from "../gen/api/v1/memo_service_pb";
import { ShortcutService } from "../gen/api/v1/shortcut_service_pb";
import type { Env } from "../env";
import type { ServiceContext } from "../services/context";
import { registerServices } from "../connect/services";
import { resolveRequestContext } from "../auth/context";

const PROTOCOL_VERSION = "2025-03-26";
const SERVER_INFO = { name: "memos", version: "1.0.0" };

// Mirror of curatedOperationIDs in server/router/mcp/catalog.go.
const CURATED: [DescService, string[]][] = [
  [
    MemoService,
    [
      "listMemos",
      "createMemo",
      "getMemo",
      "updateMemo",
      "deleteMemo",
      "listMemoComments",
      "createMemoComment",
      "listMemoAttachments",
      "setMemoAttachments",
      "listMemoReactions",
      "upsertMemoReaction",
      "deleteMemoReaction",
      "listMemoRelations",
      "setMemoRelations",
    ],
  ],
  [AttachmentService, ["listAttachments", "createAttachment", "getAttachment", "deleteAttachment"]],
  [ShortcutService, ["listShortcuts"]],
  [AuthService, ["getCurrentUser"]],
];

interface ToolDef {
  name: string;
  description: string;
  method: DescMethod;
  service: DescService;
}

function camelToSnake(value: string): string {
  return value.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toLowerCase();
}

function buildTools(): ToolDef[] {
  const tools: ToolDef[] = [];
  for (const [service, methodNames] of CURATED) {
    const prefix = service.name.replace(/Service$/, "");
    for (const localName of methodNames) {
      const method = service.methods.find((m) => m.localName === localName);
      if (!method) {
        throw new Error(`curated method ${service.typeName}.${localName} not found`);
      }
      tools.push({
        name: `${camelToSnake(prefix)}_${camelToSnake(method.name)}`,
        description: `Calls ${service.typeName}.${method.name}. Input is the protobuf JSON encoding of ${method.input.typeName}.`,
        method,
        service,
      });
    }
  }
  return tools;
}

const TOOLS = buildTools();

// Depth-limited JSON schema derived from the protobuf message descriptor.
function messageSchema(message: DescMessage, depth = 0): Record<string, unknown> {
  if (depth > 2) {
    return { type: "object" };
  }
  const properties: Record<string, unknown> = {};
  for (const field of message.fields) {
    properties[field.jsonName || field.name] = fieldSchema(field, depth);
  }
  return { type: "object", properties, additionalProperties: false };
}

function fieldSchema(field: DescField, depth: number): Record<string, unknown> {
  const scalar = (): Record<string, unknown> => {
    switch (field.fieldKind) {
      case "message":
        return messageSchema(field.message, depth + 1);
      case "enum":
        return { type: "string", enum: field.enum.values.map((v) => v.name) };
      case "scalar": {
        const t = field.scalar;
        if (t === 8) return { type: "boolean" }; // BOOL
        if (t === 9 || t === 12) return { type: "string" }; // STRING/BYTES(base64)
        return { type: "number" };
      }
      default:
        return {};
    }
  };
  if (field.fieldKind === "list") {
    const item =
      field.listKind === "message"
        ? messageSchema(field.message, depth + 1)
        : field.listKind === "enum"
          ? { type: "string" }
          : { type: field.scalar === 9 ? "string" : "number" };
    return { type: "array", items: item };
  }
  if (field.fieldKind === "map") {
    return { type: "object" };
  }
  return scalar();
}

type JsonRpcRequest = { jsonrpc: "2.0"; id?: number | string | null; method: string; params?: Record<string, unknown> };

export async function handleMcpRequest(request: Request, env: Env, executionContext: ExecutionContext): Promise<Response> {
  if (request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405, headers: { Allow: "POST" } });
  }
  const auth = await resolveRequestContext(request, env);
  const ctx: ServiceContext = { env, user: auth.user, waitUntil: (p) => executionContext.waitUntil(p) };

  let message: JsonRpcRequest;
  try {
    message = (await request.json()) as JsonRpcRequest;
  } catch {
    return jsonRpcError(null, -32700, "parse error");
  }
  if (Array.isArray(message)) {
    return jsonRpcError(null, -32600, "batch requests are not supported");
  }

  // Notifications get an empty 202.
  if (message.id === undefined || message.method.startsWith("notifications/")) {
    return new Response(null, { status: 202 });
  }

  switch (message.method) {
    case "initialize":
      return jsonRpcResult(message.id, {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: { tools: {} },
        serverInfo: SERVER_INFO,
      });
    case "ping":
      return jsonRpcResult(message.id, {});
    case "tools/list":
      return jsonRpcResult(message.id, {
        tools: TOOLS.map((tool) => ({
          name: tool.name,
          description: tool.description,
          inputSchema: messageSchema(tool.method.input),
        })),
      });
    case "tools/call": {
      const params = message.params ?? {};
      const toolName = params.name as string;
      const tool = TOOLS.find((t) => t.name === toolName);
      if (!tool) {
        return jsonRpcError(message.id, -32602, `unknown tool: ${toolName}`);
      }
      const method = tool.method;
      if (method.methodKind !== "unary") {
        return jsonRpcError(message.id, -32602, `tool ${toolName} is not unary`);
      }
      try {
        const input = fromJson(method.input, (params.arguments ?? {}) as never, { ignoreUnknownFields: true });
        const transport = createRouterTransport((router) => registerServices(router, ctx));
        // DescMethod's methodKind isn't a discriminant in this protobuf-es
        // version; the unary check above guarantees the cast is safe.
        const response = await transport.unary(method as never, undefined, undefined, undefined, input);
        const text = JSON.stringify(toJson(tool.method.output, create(tool.method.output, response.message)));
        return jsonRpcResult(message.id, { content: [{ type: "text", text }], isError: false });
      } catch (error) {
        const text = error instanceof ConnectError ? error.rawMessage : String(error);
        return jsonRpcResult(message.id, { content: [{ type: "text", text }], isError: true });
      }
    }
    default:
      return jsonRpcError(message.id, -32601, `method not found: ${message.method}`);
  }
}

function jsonRpcResult(id: number | string | null | undefined, result: unknown): Response {
  return Response.json({ jsonrpc: "2.0", id: id ?? null, result });
}

function jsonRpcError(id: number | string | null | undefined, code: number, message: string): Response {
  return Response.json({ jsonrpc: "2.0", id: id ?? null, error: { code, message } }, { status: 200 });
}
