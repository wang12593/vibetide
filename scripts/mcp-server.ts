import express from "express";

const DEFAULT_MCP_PORT = 3033;

function resolvePort(): number {
  const rawPort = process.env.MCP_PORT;

  if (!rawPort) {
    return DEFAULT_MCP_PORT;
  }

  const port = Number.parseInt(rawPort, 10);

  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new Error(`Invalid MCP_PORT: ${rawPort}`);
  }

  return port;
}

const app = express();

app.use(express.json());

app.get("/mcp", (_req, res) => {
  res.status(405).json({
    error: "method_not_allowed",
    message: "Use POST /mcp for MCP requests.",
  });
});

app.post("/mcp", (_req, res) => {
  res.status(501).json({
    error: "not_implemented",
    message: "MCP server implementation is pending.",
  });
});

const port = resolvePort();
const server = app.listen(port, () => {
  const address = server.address();
  const listeningPort =
    typeof address === "object" && address !== null ? address.port : port;

  console.log(`MCP server listening on port ${listeningPort}`);
});

function shutdown(): void {
  server.close(() => {
    process.exit(0);
  });

  setTimeout(() => {
    process.exit(1);
  }, 5000).unref();
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
