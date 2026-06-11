import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { createMcpToolInvocation } from "@/lib/dal/mcp-tool-invocations";
import {
  executeIntegrationTool,
  listIntegrationTools,
} from "../registry";
import type {
  AdapterExecutionContext,
  AdapterToolResult,
  IntegrationAdapter,
} from "../types";

vi.mock("@/lib/dal/mcp-tool-invocations", () => ({
  createMcpToolInvocation: vi.fn(),
}));

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

const auditExecuteMock = vi.fn(async (_toolName, input): Promise<AdapterToolResult> => ({
  ok: true,
  data: input,
  audit: { externalRequestId: "ext_1" },
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

const envAdapter: IntegrationAdapter = {
  manifest: {
    id: "env-demo",
    displayName: "Env Demo",
    version: "1.0.0",
    authMode: "env",
    tools: [
      {
        name: "env.ping",
        title: "Ping",
        description: "Ping using env credentials",
        permissions: ["demo:read"],
        destructive: false,
        audit: false,
      },
    ],
  },
  tools: [
    {
      name: "env.ping",
      title: "Ping",
      description: "Ping using env credentials",
      inputSchema: z.object({ text: z.string() }),
    },
  ],
  execute: executeMock,
};

const mcpApiKeyContext: AdapterExecutionContext = {
  ...context,
  actorId: "api-key-1",
  actorType: "api_key",
  source: "mcp",
};

const auditAdapter: IntegrationAdapter = {
  manifest: {
    id: "audit-demo",
    displayName: "Audit Demo",
    version: "1.0.0",
    authMode: "none",
    tools: [
      {
        name: "audit.echo",
        title: "Audit Echo",
        description: "Echo input text with audit metadata",
        permissions: ["demo:read"],
        destructive: false,
        audit: true,
      },
    ],
  },
  tools: [
    {
      name: "audit.echo",
      title: "Audit Echo",
      description: "Echo input text with audit metadata",
      inputSchema: z.object({ text: z.string() }),
    },
  ],
  execute: auditExecuteMock,
};

describe("integration registry", () => {
  beforeEach(() => {
    executeMock.mockClear();
    auditExecuteMock.mockClear();
    vi.mocked(createMcpToolInvocation).mockReset();
    vi.mocked(createMcpToolInvocation).mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
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

  it("supports env auth adapters from mcp api key contexts without output schema", async () => {
    const tools = listIntegrationTools([envAdapter]);
    expect(tools).toHaveLength(1);
    expect(tools[0].name).toBe("env.ping");

    const result = await executeIntegrationTool(
      [envAdapter],
      "env.ping",
      { text: "hello" },
      mcpApiKeyContext,
    );

    expect(result.ok).toBe(true);
    expect(result.requestId).toBe("req_1");
    expect(executeMock).toHaveBeenCalledOnce();
  });

  it("preserves audit metadata returned by adapters", async () => {
    const result = await executeIntegrationTool(
      [auditAdapter],
      "audit.echo",
      { text: "hello" },
      context,
    );

    expect(result.ok).toBe(true);
    expect(result.audit).toEqual({ externalRequestId: "ext_1" });
    expect(result.requestId).toBe("req_1");
  });

  it("writes an audit row for audited success results", async () => {
    const result = await executeIntegrationTool(
      [auditAdapter],
      "audit.echo",
      { text: "hello" },
      context,
    );

    expect(result.ok).toBe(true);
    expect(createMcpToolInvocation).toHaveBeenCalledOnce();
    expect(createMcpToolInvocation).toHaveBeenCalledWith(
      expect.objectContaining({
        requestId: "req_1",
        adapterId: "audit-demo",
        toolName: "audit.echo",
        organizationId: context.organizationId,
        actorId: context.actorId,
        actorType: context.actorType,
        source: context.source,
        inputSummary: { text: "[redacted_content]" },
        resultStatus: "success",
        errorCode: undefined,
        durationMs: expect.any(Number),
      }),
    );
  });

  it("writes an error audit row for audited validation failures", async () => {
    const result = await executeIntegrationTool(
      [auditAdapter],
      "audit.echo",
      { text: 123, apiKey: "secret" },
      context,
    );

    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe("invalid_input");
    expect(createMcpToolInvocation).toHaveBeenCalledOnce();
    expect(createMcpToolInvocation).toHaveBeenCalledWith(
      expect.objectContaining({
        adapterId: "audit-demo",
        toolName: "audit.echo",
        inputSummary: { text: "[redacted_content]", apiKey: "[redacted]" },
        resultStatus: "error",
        errorCode: "invalid_input",
      }),
    );
  });

  it("writes an error audit row for audited permission failures", async () => {
    const result = await executeIntegrationTool(
      [auditAdapter],
      "audit.echo",
      { text: "hello" },
      { ...context, permissions: [] },
    );

    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe("permission_denied");
    expect(createMcpToolInvocation).toHaveBeenCalledOnce();
    expect(createMcpToolInvocation).toHaveBeenCalledWith(
      expect.objectContaining({
        adapterId: "audit-demo",
        toolName: "audit.echo",
        inputSummary: { text: "[redacted_content]" },
        resultStatus: "error",
        errorCode: "permission_denied",
      }),
    );
    expect(auditExecuteMock).not.toHaveBeenCalled();
  });

  it("writes an error audit row for audited adapter exceptions", async () => {
    auditExecuteMock.mockRejectedValueOnce(new Error("boom"));

    const result = await executeIntegrationTool(
      [auditAdapter],
      "audit.echo",
      { text: "hello" },
      context,
    );

    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe("adapter_exception");
    expect(createMcpToolInvocation).toHaveBeenCalledOnce();
    expect(createMcpToolInvocation).toHaveBeenCalledWith(
      expect.objectContaining({
        adapterId: "audit-demo",
        toolName: "audit.echo",
        inputSummary: { text: "[redacted_content]" },
        resultStatus: "error",
        errorCode: "adapter_exception",
      }),
    );
  });

  it("returns audited results without waiting for audit persistence", async () => {
    let resolveAuditWrite: () => void = () => {};
    const auditWriteFinished = new Promise<void>((resolve) => {
      resolveAuditWrite = resolve;
    });
    vi.mocked(createMcpToolInvocation).mockReturnValueOnce(auditWriteFinished);

    const resultPromise = executeIntegrationTool(
      [auditAdapter],
      "audit.echo",
      { text: "hello" },
      context,
    );
    const raceResult = await Promise.race([
      resultPromise.then(() => "returned"),
      new Promise<"blocked">((resolve) => {
        setTimeout(() => resolve("blocked"), 0);
      }),
    ]);

    resolveAuditWrite();
    await resultPromise;

    expect(raceResult).toBe("returned");
  });

  it("does not block execution when audit writing fails", async () => {
    vi.mocked(createMcpToolInvocation).mockRejectedValueOnce(
      new Error("database unavailable"),
    );
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const result = await executeIntegrationTool(
      [auditAdapter],
      "audit.echo",
      { text: "hello" },
      context,
    );

    expect(result.ok).toBe(true);
    expect(result.data).toEqual({ text: "hello" });
    expect(result.requestId).toBe("req_1");
    await Promise.resolve();
    expect(warnSpy).toHaveBeenCalledWith("[integrations] audit write failed");
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
