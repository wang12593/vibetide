import { createMcpToolInvocation } from "@/lib/dal/mcp-tool-invocations";
import type {
  AdapterExecutionContext,
  AdapterToolResult,
  RegisteredIntegrationTool,
} from "./types";

const SENSITIVE_KEY_RE =
  /(api[-_]?key|authorization|token|secret|password|credential)/i;
const CONTENT_KEY_RE = /(body|html|content|requestPayload|responsePayload)/i;
const MAX_STRING_LENGTH = 200;

export function summarizeIntegrationInput(
  input: unknown,
): Record<string, unknown> {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { value: typeof input };
  }

  const summary: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    if (SENSITIVE_KEY_RE.test(key)) {
      summary[key] = "[redacted]";
      continue;
    }

    if (CONTENT_KEY_RE.test(key)) {
      summary[key] = "[redacted_content]";
      continue;
    }

    if (
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean" ||
      value === null
    ) {
      summary[key] =
        typeof value === "string" && value.length > MAX_STRING_LENGTH
          ? `${value.slice(0, MAX_STRING_LENGTH)}...`
          : value;
      continue;
    }

    summary[key] = Array.isArray(value) ? `[array:${value.length}]` : "[object]";
  }

  return summary;
}

export async function auditIntegrationInvocation(params: {
  tool: RegisteredIntegrationTool;
  context: AdapterExecutionContext;
  input: unknown;
  result: AdapterToolResult;
  durationMs: number;
}): Promise<void> {
  if (!params.tool.manifest.audit) return;

  try {
    await createMcpToolInvocation({
      requestId: params.context.requestId,
      adapterId: params.tool.adapterId,
      toolName: params.tool.name,
      organizationId: params.context.organizationId,
      actorId: params.context.actorId,
      actorType: params.context.actorType,
      source: params.context.source,
      inputSummary: summarizeIntegrationInput(params.input),
      resultStatus: params.result.ok ? "success" : "error",
      errorCode: params.result.error?.code,
      durationMs: params.durationMs,
    });
  } catch (error) {
    void error;
    if (process.env.NODE_ENV !== "production") {
      console.warn("[integrations] audit write failed");
    }
  }
}
