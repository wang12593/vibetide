import { describe, expect, it, vi, beforeEach } from "vitest";
import { z } from "zod";
import {
  createIntegrationAgentTools,
  toAgentToolAlias,
} from "./integration-bridge";
import type {
  AdapterExecutionContext,
  IntegrationAdapter,
} from "@/lib/integrations/types";

const executeMock = vi.fn(async (_toolName, input) => ({
  ok: true,
  data: input,
}));

const adapter: IntegrationAdapter = {
  manifest: {
    id: "demo",
    displayName: "Demo",
    version: "1.0.0",
    authMode: "none",
    tools: [
      {
        name: "demo.echo",
        title: "Echo",
        description: "Echo text",
        permissions: ["demo:read"],
        destructive: false,
        audit: false,
      },
      {
        name: "demo.write",
        title: "Write",
        description: "Write text",
        permissions: ["demo:write"],
        destructive: false,
        audit: false,
      },
    ],
  },
  tools: [
    {
      name: "demo.echo",
      title: "Echo",
      description: "Echo text",
      inputSchema: z.object({ text: z.string() }),
    },
    {
      name: "demo.write",
      title: "Write",
      description: "Write text",
      inputSchema: z.object({ text: z.string() }),
    },
  ],
  execute: executeMock,
};

const context: AdapterExecutionContext = {
  organizationId: "org_1",
  actorId: "employee_1",
  actorType: "agent",
  requestId: "req_1",
  source: "agent",
  permissions: ["demo:read"],
};

describe("createIntegrationAgentTools", () => {
  beforeEach(() => {
    executeMock.mockClear();
  });

  it("maps non-agent tool name characters to underscores", () => {
    expect(toAgentToolAlias("cms.publish_article")).toBe("cms_publish_article");
    expect(toAgentToolAlias("cms:sync catalog")).toBe("cms_sync_catalog");
  });

  it("does not expose tools without permissions", () => {
    const tools = createIntegrationAgentTools({
      adapters: [adapter],
      context,
    });

    expect(Object.keys(tools)).toEqual(["demo_echo"]);
  });

  it("executes adapter tools through the integration registry", async () => {
    const tools = createIntegrationAgentTools({
      adapters: [adapter],
      context,
    });

    const result = await tools.demo_echo.execute?.({ text: "hello" }, {
      toolCallId: "call_1",
      messages: [],
    });

    expect(executeMock).toHaveBeenCalledWith("demo.echo", { text: "hello" }, context);
    expect(result).toEqual({
      ok: true,
      data: { text: "hello" },
      requestId: "req_1",
    });
  });
});
