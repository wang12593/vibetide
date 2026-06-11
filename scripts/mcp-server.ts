import { createMcpExpressApp } from "@modelcontextprotocol/sdk/server/express.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { ErrorRequestHandler, Request, Response } from "express";

import { cmsAdapter } from "@/lib/integrations/cms";
import { authenticateMcpRequest } from "@/lib/mcp/auth";
import { buildMcpServer } from "@/lib/mcp/server";

const DEFAULT_MCP_PORT = 3033;
const MCP_HOST = "127.0.0.1";

function resolvePort(): number {
  const rawPort = process.env.MCP_PORT;

  if (!rawPort) {
    return DEFAULT_MCP_PORT;
  }

  const port = Number(rawPort);

  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new Error(`Invalid MCP_PORT: ${rawPort}`);
  }

  return port;
}

function toHeaders(req: Request): Headers {
  const headers = new Headers();

  for (const [name, value] of Object.entries(req.headers)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        headers.append(name, item);
      }
      continue;
    }

    if (value !== undefined) {
      headers.set(name, value);
    }
  }

  return headers;
}

function sendJsonRpcError(
  res: Response,
  status: number,
  code: number,
  message: string,
  data?: Record<string, unknown>,
): void {
  res.status(status).json({
    jsonrpc: "2.0",
    id: null,
    error: {
      code,
      message,
      ...(data ? { data } : {}),
    },
  });
}

const app = createMcpExpressApp({ host: MCP_HOST });

app.get("/mcp", (_req, res) => {
  res.set("Allow", "POST");
  sendJsonRpcError(res, 405, -32000, "Method not allowed");
});

app.delete("/mcp", (_req, res) => {
  res.set("Allow", "POST");
  sendJsonRpcError(res, 405, -32000, "Method not allowed");
});

app.post("/mcp", async (req, res, next) => {
  let mcpServer: ReturnType<typeof buildMcpServer> | undefined;
  let transport: StreamableHTTPServerTransport | undefined;
  let closed = false;

  const closeConnection = async () => {
    if (closed) {
      return;
    }
    closed = true;
    await Promise.allSettled([transport?.close(), mcpServer?.close()]);
  };

  try {
    const auth = authenticateMcpRequest(toHeaders(req));

    if (!auth.ok) {
      sendJsonRpcError(res, auth.error.status, -32001, auth.error.message, {
        code: auth.error.code,
      });
      return;
    }

    mcpServer = buildMcpServer({
      adapters: [cmsAdapter],
      context: auth.context,
    });
    transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });

    res.on("close", () => {
      void closeConnection();
    });

    await mcpServer.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    await closeConnection();

    if (res.headersSent) {
      next(error);
      return;
    }

    sendJsonRpcError(res, 500, -32603, "Internal MCP server error");
  }
});

const jsonRpcErrorHandler: ErrorRequestHandler = (error, _req, res, next) => {
  if (res.headersSent) {
    next(error);
    return;
  }

  if (isJsonBodyParseError(error)) {
    sendJsonRpcError(res, 400, -32700, "Parse error");
    return;
  }

  sendJsonRpcError(res, 500, -32603, "Internal MCP server error");
};

app.use(jsonRpcErrorHandler);

const port = resolvePort();
const httpServer = app.listen(port, MCP_HOST, () => {
  const address = httpServer.address();
  const listeningPort =
    typeof address === "object" && address !== null ? address.port : port;

  console.log(`MCP server listening at http://${MCP_HOST}:${listeningPort}/mcp`);
});

function shutdown(): void {
  httpServer.close(() => {
    process.exit(0);
  });

  setTimeout(() => {
    process.exit(1);
  }, 5000).unref();
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

function isJsonBodyParseError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const bodyParserError = error as Error & {
    body?: unknown;
    status?: number;
    type?: string;
  };

  return (
    bodyParserError.type === "entity.parse.failed" ||
    (bodyParserError.status === 400 && "body" in bodyParserError)
  );
}
