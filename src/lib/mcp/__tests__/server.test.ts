import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { buildMcpServer } from "../server";
import type {
  AdapterExecutionContext,
  AdapterToolResult,
  IntegrationAdapter,
} from "@/lib/integrations/types";

const context: AdapterExecutionContext = {
  organizationId: "org_1",
  actorId: "actor_1",
  actorType: "api_key",
  requestId: "req_1",
  source: "mcp",
  permissions: ["demo:read"],
};

const executeMock = vi.fn(
  async (_toolName: string, input: unknown): Promise<AdapterToolResult> => ({
    ok: true,
    data: input,
  }),
);

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
      {
        name: "demo.write",
        title: "Write",
        description: "Write input text",
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
      description: "Echo input text",
      inputSchema: z.object({ text: z.string() }),
      outputSchema: z.object({ text: z.string() }),
    },
    {
      name: "demo.write",
      title: "Write",
      description: "Write input text",
      inputSchema: z.object({ text: z.string() }),
      outputSchema: z.object({ text: z.string() }),
    },
  ],
  execute: executeMock,
};

const failingAdapter: IntegrationAdapter = {
  ...demoAdapter,
  execute: vi.fn(() => {
    throw new Error("adapter secret failure");
  }),
};

describe("buildMcpServer", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("builds an MCP server", () => {
    const server = buildMcpServer({ adapters: [demoAdapter], context });

    expect(server).toBeDefined();
  });

  it("lists integration tools through the MCP SDK", async () => {
    const connection = await connectDemoClient(context);

    try {
      const result = await connection.client.listTools();

      expect(result.tools).toEqual([
        expect.objectContaining({
          name: "demo.echo",
          title: "Echo",
          description: "Echo input text",
        }),
      ]);
    } finally {
      await connection.close();
    }
  });

  it("calls an integration tool and returns structured and text content", async () => {
    const connection = await connectDemoClient(context);

    try {
      const result = await connection.client.callTool({
        name: "demo.echo",
        arguments: { text: "hello" },
      });

      const expectedPayload = {
        ok: true,
        data: { text: "hello" },
        requestId: "req_1",
      };

      expect(result.isError).toBe(false);
      expect(result.structuredContent).toEqual(expectedPayload);
      expect(result.content).toEqual([
        {
          type: "text",
          text: JSON.stringify(expectedPayload, null, 2),
        },
      ]);
      expect(executeMock).toHaveBeenCalledWith(
        "demo.echo",
        { text: "hello" },
        context,
      );
    } finally {
      await connection.close();
    }
  });

  it("does not list integration tools missing required permissions", async () => {
    const connection = await connectDemoClient(context);

    try {
      const result = await connection.client.listTools();

      expect(result.tools.map((toolDef) => toolDef.name)).toEqual([
        "demo.echo",
      ]);
      expect(result.tools.map((toolDef) => toolDef.name)).not.toContain(
        "demo.write",
      );
    } finally {
      await connection.close();
    }
  });

  it("returns an MCP error result when an adapter throws", async () => {
    const connection = await connectDemoClient(context, [failingAdapter]);

    try {
      const result = await connection.client.callTool({
        name: "demo.echo",
        arguments: { text: "hello" },
      });

      expect(result.isError).toBe(true);
      expect(result.structuredContent).toMatchObject({
        ok: false,
        requestId: "req_1",
        error: {
          code: "adapter_exception",
          stage: "execution",
          retriable: false,
        },
      });
      expect(result.content).toEqual([
        {
          type: "text",
          text: JSON.stringify(result.structuredContent, null, 2),
        },
      ]);
      expect(JSON.stringify(result.structuredContent)).not.toContain(
        "adapter secret failure",
      );
    } finally {
      await connection.close();
    }
  });
});

async function connectDemoClient(
  contextOverride: AdapterExecutionContext,
  adapters: IntegrationAdapter[] = [demoAdapter],
) {
  const server = buildMcpServer({
    adapters,
    context: contextOverride,
  });
  const client = new Client({ name: "test-client", version: "1.0.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

  await Promise.all([
    server.connect(serverTransport),
    client.connect(clientTransport),
  ]);

  return {
    client,
    async close() {
      await Promise.allSettled([
        client.close(),
        server.close(),
        clientTransport.close(),
        serverTransport.close(),
      ]);
    },
  };
}
