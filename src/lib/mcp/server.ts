import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

import {
  executeIntegrationTool,
  listIntegrationTools,
} from "@/lib/integrations/registry";
import type {
  AdapterExecutionContext,
  AdapterToolResult,
  IntegrationAdapter,
  RegisteredIntegrationTool,
} from "@/lib/integrations/types";

export interface BuildMcpServerParams {
  adapters: IntegrationAdapter[];
  context: AdapterExecutionContext;
}

export function buildMcpServer(params: BuildMcpServerParams): McpServer {
  const server = new McpServer({
    name: "vibetide-integrations",
    version: "1.0.0",
  });

  for (const registered of listIntegrationTools(params.adapters)) {
    if (!hasAllPermissions(params.context, registered)) {
      continue;
    }

    server.registerTool(
      registered.name,
      {
        title: registered.title,
        description: registered.description,
        inputSchema: registered.definition.inputSchema,
      },
      async (input) => {
        const result = await executeIntegrationTool(
          params.adapters,
          registered.name,
          input,
          params.context,
        );

        return toMcpCallToolResult(result);
      },
    );
  }

  return server;
}

function hasAllPermissions(
  context: AdapterExecutionContext,
  tool: RegisteredIntegrationTool,
): boolean {
  return tool.permissions.every((permission) =>
    context.permissions.includes(permission),
  );
}

function toMcpCallToolResult(result: AdapterToolResult): CallToolResult {
  const payload = {
    ...result,
    requestId: result.requestId,
  };

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(payload, null, 2),
      },
    ],
    structuredContent: payload as Record<string, unknown>,
    isError: !result.ok,
  };
}
