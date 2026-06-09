import { describe, expect, it } from "vitest";
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
  execute: async (_toolName, input) => ({
    ok: true,
    data: input,
  }),
};

describe("integration registry", () => {
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
  });
});
