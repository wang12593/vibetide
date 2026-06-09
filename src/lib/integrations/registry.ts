import { adapterFailure, permissionDenied } from "./errors";
import type {
  AdapterExecutionContext,
  AdapterToolManifest,
  AdapterToolResult,
  IntegrationAdapter,
  RegisteredIntegrationTool,
} from "./types";

type IntegrationToolResolution =
  | {
      ok: true;
      adapter: IntegrationAdapter;
      tool: RegisteredIntegrationTool;
    }
  | {
      ok: false;
      code:
        | "tool_not_found"
        | "tool_definition_missing"
        | "tool_manifest_missing";
      message: string;
      adapter?: IntegrationAdapter;
      manifest?: AdapterToolManifest;
    };

export function listIntegrationTools(
  adapters: IntegrationAdapter[],
): RegisteredIntegrationTool[] {
  return adapters.flatMap((adapter) => {
    for (const definition of adapter.tools) {
      const manifest = adapter.manifest.tools.find(
        (tool) => tool.name === definition.name,
      );
      if (!manifest) {
        throw new Error(
          `Integration adapter "${adapter.manifest.id}" tool manifest missing for definition tool "${definition.name}"`,
        );
      }
    }

    return adapter.manifest.tools.map((manifest) => {
      const definition = adapter.tools.find((tool) => tool.name === manifest.name);
      if (!definition) {
        throw new Error(
          `Integration adapter "${adapter.manifest.id}" tool definition missing for manifest tool "${manifest.name}"`,
        );
      }

      return {
        adapterId: adapter.manifest.id,
        name: manifest.name,
        title: manifest.title,
        description: manifest.description,
        permissions: manifest.permissions,
        destructive: manifest.destructive,
        audit: manifest.audit,
        manifest,
        definition,
      };
    });
  });
}

export function resolveIntegrationTool(
  adapters: IntegrationAdapter[],
  toolName: string,
): IntegrationToolResolution {
  for (const adapter of adapters) {
    const manifest = adapter.manifest.tools.find((tool) => tool.name === toolName);
    const definition = adapter.tools.find((tool) => tool.name === toolName);
    if (!manifest) {
      if (definition) {
        return {
          ok: false,
          code: "tool_manifest_missing",
          message: `Integration adapter "${adapter.manifest.id}" tool manifest missing for definition tool "${toolName}"`,
          adapter,
        };
      }

      continue;
    }

    if (!definition) {
      return {
        ok: false,
        code: "tool_definition_missing",
        message: `Integration adapter "${adapter.manifest.id}" tool definition missing for manifest tool "${toolName}"`,
        adapter,
        manifest,
      };
    }

    return {
      ok: true,
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

  return {
    ok: false,
    code: "tool_not_found",
    message: `Integration tool not found: ${toolName}`,
  };
}

export async function executeIntegrationTool(
  adapters: IntegrationAdapter[],
  toolName: string,
  input: unknown,
  context: AdapterExecutionContext,
): Promise<AdapterToolResult> {
  const resolved = resolveIntegrationTool(adapters, toolName);
  if (!resolved.ok) {
    return withRequestId(
      adapterFailure(
        resolved.code,
        resolved.message,
        {
          adapterId: resolved.adapter?.manifest.id,
          toolName,
        },
        "registry",
        false,
      ),
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
      }, "validation", false),
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
      }, "execution", false),
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
