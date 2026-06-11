import { tool, type ToolSet } from "ai";
import {
  executeIntegrationTool,
  listIntegrationTools,
} from "@/lib/integrations/registry";
import type {
  AdapterExecutionContext,
  IntegrationAdapter,
} from "@/lib/integrations/types";

export function toAgentToolAlias(toolName: string) {
  return toolName.replace(/[^a-zA-Z0-9_]/g, "_");
}

function hasAllPermissions(
  context: AdapterExecutionContext,
  permissions: string[],
) {
  return permissions.every((permission) =>
    context.permissions.includes(permission),
  );
}

export function createIntegrationAgentTools(params: {
  adapters: IntegrationAdapter[];
  context: AdapterExecutionContext;
}): ToolSet {
  const tools: ToolSet = {};

  for (const registered of listIntegrationTools(params.adapters)) {
    if (!hasAllPermissions(params.context, registered.manifest.permissions)) {
      continue;
    }

    tools[toAgentToolAlias(registered.name)] = tool({
      description: registered.description,
      inputSchema: registered.definition.inputSchema,
      execute: async (input) => {
        return await executeIntegrationTool(
          params.adapters,
          registered.name,
          input,
          params.context,
        );
      },
    });
  }

  return tools;
}
