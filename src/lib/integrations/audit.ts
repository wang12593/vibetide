import { createMcpToolInvocation } from "@/lib/dal/mcp-tool-invocations";
import type {
  AdapterExecutionContext,
  AdapterToolResult,
  RegisteredIntegrationTool,
} from "./types";

const SENSITIVE_KEY_RE =
  /(apikey|authorization|token|secret|password|credential|cookie|session|jwt|privatekey|signature)/i;
const CONTENT_KEY_RE =
  /(body|html|content|requestpayload|responsepayload|text|prompt|markdown|message|query|url|uri)/i;
const RISKY_STRING_VALUE_RE =
  /(^bearer\s+\S+)|(\b[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{6,}\b)|(-----BEGIN [A-Z ]*PRIVATE KEY-----)|(\b(?:sk|pk|rk|ghp|gho|github_pat|xox[baprs])[-_][A-Za-z0-9_-]{16,}\b)|(\bAIza[A-Za-z0-9_-]{20,}\b)|(\bAKIA[0-9A-Z]{16}\b)|([?&][^=]*(?:token|signature|key|secret|password|session|code)[^=]*=)/i;
const MAX_STRING_LENGTH = 200;

export function summarizeIntegrationInput(
  input: unknown,
): Record<string, unknown> {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { value: typeof input };
  }

  const summary: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    const normalizedKey = normalizeSummaryKey(key);
    if (SENSITIVE_KEY_RE.test(normalizedKey)) {
      summary[key] = "[redacted]";
      continue;
    }

    if (CONTENT_KEY_RE.test(normalizedKey)) {
      summary[key] = "[redacted_content]";
      continue;
    }

    if (
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean" ||
      value === null
    ) {
      if (typeof value === "string" && isRiskyStringValue(value)) {
        summary[key] = "[redacted]";
        continue;
      }

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

export function auditIntegrationInvocation(params: {
  tool: RegisteredIntegrationTool;
  context: AdapterExecutionContext;
  input: unknown;
  result: AdapterToolResult;
  durationMs: number;
}): void {
  if (!params.tool.manifest.audit) return;

  try {
    void Promise.resolve(
      createMcpToolInvocation({
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
      }),
    ).catch(logAuditWriteFailure);
  } catch {
    logAuditWriteFailure();
  }
}

function normalizeSummaryKey(key: string): string {
  return key.replace(/[-_\s]/g, "").toLowerCase();
}

function isRiskyStringValue(value: string): boolean {
  return RISKY_STRING_VALUE_RE.test(value);
}

function logAuditWriteFailure(): void {
  if (process.env.NODE_ENV !== "production") {
    console.warn("[integrations] audit write failed");
  }
}
