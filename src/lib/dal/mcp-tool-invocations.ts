import { db } from "@/db";
import { mcpToolInvocations } from "@/db/schema";
import type {
  AdapterActorType,
  AdapterSource,
} from "@/lib/integrations/types";

export interface CreateMcpToolInvocationInput {
  requestId: string;
  adapterId: string;
  toolName: string;
  organizationId: string;
  actorId: string;
  actorType: AdapterActorType;
  source: AdapterSource;
  inputSummary?: Record<string, unknown>;
  resultStatus: "success" | "error";
  errorCode?: string;
  durationMs?: number;
}

export async function createMcpToolInvocation(
  input: CreateMcpToolInvocationInput,
): Promise<void> {
  await db.insert(mcpToolInvocations).values({
    requestId: input.requestId,
    adapterId: input.adapterId,
    toolName: input.toolName,
    organizationId: input.organizationId,
    actorId: input.actorId,
    actorType: input.actorType,
    source: input.source,
    inputSummary: input.inputSummary,
    resultStatus: input.resultStatus,
    errorCode: input.errorCode,
    durationMs: input.durationMs,
  });
}
