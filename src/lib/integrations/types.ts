import type { ZodType } from "zod";

export type AdapterActorType = "user" | "agent" | "api_key";

export type AdapterSource = "mcp" | "agent" | "server_action";

export type AdapterAuthMode = "none" | "env" | "oauth" | "api_key";

export interface AdapterExecutionContext {
  organizationId: string;
  actorId: string;
  actorType: AdapterActorType;
  requestId: string;
  source: AdapterSource;
  permissions: string[];
}

export interface AdapterToolManifest {
  name: string;
  title: string;
  description: string;
  permissions: string[];
  destructive: boolean;
  audit: boolean;
}

export interface AdapterManifest {
  id: string;
  displayName: string;
  version: string;
  authMode: AdapterAuthMode;
  tools: AdapterToolManifest[];
}

export interface AdapterToolDefinition<
  TInput = unknown,
  TOutput = unknown,
> {
  name: string;
  title: string;
  description: string;
  inputSchema: ZodType<TInput>;
  outputSchema?: ZodType<TOutput>;
}

export interface AdapterToolError {
  code: string;
  message: string;
  stage?: string;
  retriable?: boolean;
  details?: unknown;
}

export interface AdapterToolResult<TData = unknown> {
  ok: boolean;
  data?: TData;
  error?: AdapterToolError;
  requestId?: string;
}

export interface IntegrationAdapter {
  manifest: AdapterManifest;
  tools: AdapterToolDefinition[];
  execute(
    toolName: string,
    input: unknown,
    context: AdapterExecutionContext,
  ): Promise<AdapterToolResult> | AdapterToolResult;
}

export interface RegisteredIntegrationTool {
  adapterId: string;
  name: string;
  title: string;
  description: string;
  permissions: string[];
  destructive: boolean;
  audit: boolean;
  manifest: AdapterToolManifest;
  definition: AdapterToolDefinition;
}
