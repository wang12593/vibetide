import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import {
  executeIntegrationTool,
  listIntegrationTools,
} from "../registry";
import type { IntegrationAdapter, AdapterExecutionContext } from "../types";

const context: AdapterExecutionContext = {
  organizationId: "00000000-0000-0000-0000-000000000001",
  actorId: "agent-xiaofa",
  actorType: "agent",
  requestId: "req_1",
  source: "agent",
  permissions: ["demo:read"],
};

const executeMock = vi.fn(async (_toolName, input) => ({
  ok: true,
  data: input,
}));

const demoAdapter: IntegrationAdapter = {
  manifest: {
    id: "demo",
    displayName: "Demo",
    version: "1.0.0",
    authMode: "none",
    tools: [
      {
        name: "demo.echo",
        title: "Echo",
        description: "Echo input text",
        permissions: ["demo:read"],
        destructive: false,
        audit: false,
      },
    ],
  },
  tools: [
    {
      name: "demo.echo",
      title: "Echo",
      description: "Echo input text",
      inputSchema: z.object({ text: z.string() }),
      outputSchema: z.object({ text: z.string() }),
    },
  ],
  execute: executeMock,
};

describe("integration registry", () => {
  beforeEach(() => {
    executeMock.mockClear();
  });

  it("lists tools from adapters", () => {
    const tools = listIntegrationTools([demoAdapter]);
    expect(tools).toHaveLength(1);
    expect(tools[0].name).toBe("demo.echo");
    expect(tools[0].adapterId).toBe("demo");
  });

  it("executes a known tool when permission is present", async () => {
    const result = await executeIntegrationTool(
      [demoAdapter],
      "demo.echo",
      { text: "hello" },
      context,
    );
    expect(result.ok).toBe(true);
    expect(result.data).toEqual({ text: "hello" });
    expect(result.requestId).toBe("req_1");
    expect(executeMock).toHaveBeenCalledOnce();
  });

  it("rejects unknown tools", async () => {
    const result = await executeIntegrationTool(
      [demoAdapter],
      "demo.missing",
      {},
      context,
    );
    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe("tool_not_found");
    expect(result.error?.stage).toBe("registry");
    expect(result.error?.retriable).toBe(false);
    expect(result.requestId).toBe("req_1");
    expect(executeMock).not.toHaveBeenCalled();
  });

  it("rejects missing permissions", async () => {
    const result = await executeIntegrationTool(
      [demoAdapter],
      "demo.echo",
      { text: "hello" },
      { ...context, permissions: [] },
    );
    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe("permission_denied");
    expect(result.error?.stage).toBe("auth");
    expect(result.error?.retriable).toBe(false);
    expect(result.requestId).toBe("req_1");
    expect(executeMock).not.toHaveBeenCalled();
  });

  it("returns schema validation errors before execution", async () => {
    const result = await executeIntegrationTool(
      [demoAdapter],
      "demo.echo",
      { text: 123 },
      context,
    );
    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe("invalid_input");
    expect(result.error?.stage).toBe("validation");
    expect(result.error?.retriable).toBe(false);
    expect(result.requestId).toBe("req_1");
    expect(executeMock).not.toHaveBeenCalled();
  });

  it("returns adapter exceptions as execution errors", async () => {
    executeMock.mockRejectedValueOnce(new Error("boom"));

    const result = await executeIntegrationTool(
      [demoAdapter],
      "demo.echo",
      { text: "hello" },
      context,
    );

    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe("adapter_exception");
    expect(result.error?.stage).toBe("execution");
    expect(result.error?.retriable).toBe(false);
    expect(result.requestId).toBe("req_1");
    expect(executeMock).toHaveBeenCalledOnce();
  });

  it("throws when a listed manifest tool has no definition", () => {
    const misconfiguredAdapter: IntegrationAdapter = {
      ...demoAdapter,
      tools: [],
    };

    expect(() => listIntegrationTools([misconfiguredAdapter])).toThrow(
      /tool definition missing/i,
    );
  });

  it("returns misconfiguration when executing a manifest tool with no definition", async () => {
    const misconfiguredAdapter: IntegrationAdapter = {
      ...demoAdapter,
      tools: [],
    };

    const result = await executeIntegrationTool(
      [misconfiguredAdapter],
      "demo.echo",
      { text: "hello" },
      context,
    );

    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe("tool_definition_missing");
    expect(result.error?.stage).toBe("registry");
    expect(result.error?.retriable).toBe(false);
    expect(result.requestId).toBe("req_1");
    expect(executeMock).not.toHaveBeenCalled();
  });

  it("throws when a tool definition has no manifest metadata", () => {
    const misconfiguredAdapter: IntegrationAdapter = {
      ...demoAdapter,
      tools: [
        ...demoAdapter.tools,
        {
          name: "demo.extra",
          title: "Extra",
          description: "Extra tool",
          inputSchema: z.object({ text: z.string() }),
          outputSchema: z.object({ text: z.string() }),
        },
      ],
    };

    expect(() => listIntegrationTools([misconfiguredAdapter])).toThrow(
      /tool manifest missing/i,
    );
  });

  it("returns misconfiguration when executing a definition with no manifest metadata", async () => {
    const misconfiguredAdapter: IntegrationAdapter = {
      ...demoAdapter,
      tools: [
        ...demoAdapter.tools,
        {
          name: "demo.extra",
          title: "Extra",
          description: "Extra tool",
          inputSchema: z.object({ text: z.string() }),
          outputSchema: z.object({ text: z.string() }),
        },
      ],
    };

    const result = await executeIntegrationTool(
      [misconfiguredAdapter],
      "demo.extra",
      { text: "hello" },
      context,
    );

    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe("tool_manifest_missing");
    expect(result.error?.stage).toBe("registry");
    expect(result.error?.retriable).toBe(false);
    expect(result.requestId).toBe("req_1");
    expect(executeMock).not.toHaveBeenCalled();
  });
});
