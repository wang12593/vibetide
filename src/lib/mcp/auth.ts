import { randomUUID } from "node:crypto";
import { z } from "zod";

import type { AdapterExecutionContext } from "../integrations/types";

const mcpApiKeySchema = z.object({
  key: z.string().min(1),
  name: z.string().min(1),
  organizationId: z.string().min(1),
  actorId: z.string().min(1),
  permissions: z.array(z.string()),
});

const mcpApiKeysSchema = z.array(mcpApiKeySchema);

export type McpApiKey = z.infer<typeof mcpApiKeySchema>;

export type McpAuthContext = AdapterExecutionContext & {
  keyName: string;
};

export type McpAuthResult =
  | {
      ok: true;
      context: McpAuthContext;
    }
  | {
      ok: false;
      error: {
        code: "mcp_disabled" | "unauthorized";
        message: string;
        status: 401 | 403;
      };
    };

export function parseMcpApiKeys(): McpApiKey[] {
  const rawConfig = process.env.MCP_API_KEYS;

  if (!rawConfig) {
    return [];
  }

  try {
    return mcpApiKeysSchema.parse(JSON.parse(rawConfig));
  } catch (error) {
    throw new Error("MCP_API_KEYS must be a valid JSON array of API key configs", {
      cause: error,
    });
  }
}

export function authenticateMcpRequest(headers: Headers): McpAuthResult {
  if (process.env.MCP_SERVER_ENABLED !== "true") {
    return {
      ok: false,
      error: {
        code: "mcp_disabled",
        message: "MCP server is disabled",
        status: 403,
      },
    };
  }

  const apiKey = extractApiKey(headers);

  if (!apiKey) {
    return unauthorized();
  }

  const matchedKey = parseMcpApiKeys().find((configuredKey) => {
    return configuredKey.key === apiKey;
  });

  if (!matchedKey) {
    return unauthorized();
  }

  return {
    ok: true,
    context: {
      organizationId: matchedKey.organizationId,
      actorId: matchedKey.actorId,
      actorType: "api_key",
      requestId: randomUUID(),
      source: "mcp",
      permissions: matchedKey.permissions,
      keyName: matchedKey.name,
    },
  };
}

function extractApiKey(headers: Headers): string | null {
  const authorization = headers.get("authorization");
  const bearerMatch = authorization?.match(/^Bearer\s+(.+)$/i);

  if (bearerMatch?.[1]) {
    return bearerMatch[1].trim();
  }

  return headers.get("x-api-key")?.trim() || null;
}

function unauthorized(): McpAuthResult {
  return {
    ok: false,
    error: {
      code: "unauthorized",
      message: "Missing or invalid MCP API key",
      status: 401,
    },
  };
}
