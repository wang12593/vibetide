import { tool, type ToolSet } from "ai";
import {
  executeIntegrationTool,
  listIntegrationTools,
} from "@/lib/integrations/registry";
import type { AgentTool } from "@/lib/agent/types";
import type {
  AdapterExecutionContext,
  IntegrationAdapter,
} from "@/lib/integrations/types";
import type { AuthorityLevel } from "@/lib/types";

const CMS_PUBLISH_TOOL_NAME = "cms_publish";
const CMS_CATALOG_SYNC_TOOL_NAME = "cms_catalog_sync";

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

export function deriveCmsIntegrationPermissions(params: {
  agentTools: AgentTool[];
  authorityLevel: AuthorityLevel;
}): string[] {
  if (
    params.authorityLevel === "observer" ||
    params.authorityLevel === "advisor"
  ) {
    return [];
  }

  const toolNames = new Set(params.agentTools.map((agentTool) => agentTool.name));
  const permissions = new Set<string>();

  if (toolNames.has(CMS_PUBLISH_TOOL_NAME)) {
    permissions.add("cms:publish");
    permissions.add("cms:read");
  }

  if (toolNames.has(CMS_CATALOG_SYNC_TOOL_NAME)) {
    permissions.add("cms:sync");
    permissions.add("cms:read");
  }

  return Array.from(permissions);
}
