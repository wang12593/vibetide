import { adapterFailure, permissionDenied } from "./errors";
import type {
  AdapterExecutionContext,
  AdapterToolResult,
  IntegrationAdapter,
  RegisteredIntegrationTool,
} from "./types";

export function listIntegrationTools(
  adapters: IntegrationAdapter[],
): RegisteredIntegrationTool[] {
  return adapters.flatMap((adapter) =>
    adapter.manifest.tools.flatMap((manifest) => {
      const definition = adapter.tools.find((tool) => tool.name === manifest.name);
      if (!definition) {
        return [];
      }

      return [
        {
          adapterId: adapter.manifest.id,
          name: manifest.name,
          title: manifest.title,
          description: manifest.description,
          permissions: manifest.permissions,
          destructive: manifest.destructive,
          audit: manifest.audit,
          manifest,
          definition,
        },
      ];
    }),
  );
}

export function resolveIntegrationTool(
  adapters: IntegrationAdapter[],
  toolName: string,
):
  | {
      adapter: IntegrationAdapter;
      tool: RegisteredIntegrationTool;
    }
  | null {
  for (const adapter of adapters) {
    const manifest = adapter.manifest.tools.find((tool) => tool.name === toolName);
    if (!manifest) {
      continue;
    }

    const definition = adapter.tools.find((tool) => tool.name === toolName);
    if (!definition) {
      return null;
    }

    return {
      adapter,
      tool: {
        adapterId: adapter.manifest.id,
        name: manifest.name,
        title: manifest.title,
        description: manifest.description,
        permissions: manifest.permissions,
        destructive: manifest.destructive,
        audit: manifest.audit,
        manifest,
        definition,
      },
    };
  }

  return null;
}

export async function executeIntegrationTool(
  adapters: IntegrationAdapter[],
  toolName: string,
  input: unknown,
  context: AdapterExecutionContext,
): Promise<AdapterToolResult> {
  const resolved = resolveIntegrationTool(adapters, toolName);
  if (!resolved) {
    return withRequestId(
      adapterFailure("tool_not_found", `Integration tool not found: ${toolName}`),
      context,
    );
  }

  const missingPermission = resolved.tool.permissions.find(
    (permission) => !context.permissions.includes(permission),
  );
  if (missingPermission) {
    return withRequestId(permissionDenied(missingPermission), context);
  }

  const parsedInput = resolved.tool.definition.inputSchema.safeParse(input);
  if (!parsedInput.success) {
    return withRequestId(
      adapterFailure("invalid_input", "Integration tool input is invalid", {
        issues: parsedInput.error.issues,
      }),
      context,
    );
  }

  try {
    const result = await resolved.adapter.execute(
      toolName,
      parsedInput.data,
      context,
    );
    return withRequestId(result, context);
  } catch (error) {
    return withRequestId(
      adapterFailure("adapter_exception", "Integration adapter execution failed", {
        message: error instanceof Error ? error.message : String(error),
      }),
      context,
    );
  }
}

function withRequestId(
  result: AdapterToolResult,
  context: AdapterExecutionContext,
): AdapterToolResult {
  return {
    ...result,
    requestId: context.requestId,
  };
}
