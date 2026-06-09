import { afterEach, describe, expect, it } from "vitest";
import { authenticateMcpRequest, parseMcpApiKeys } from "../auth";

const OLD_ENV = { ...process.env };

afterEach(() => {
  for (const key of Object.keys(process.env)) {
    delete process.env[key];
  }
  Object.assign(process.env, OLD_ENV);
});

function headers(input: Record<string, string>) {
  return new Headers(input);
}

describe("parseMcpApiKeys", () => {
  it("returns an empty array when not configured", () => {
    delete process.env.MCP_API_KEYS;
    expect(parseMcpApiKeys()).toEqual([]);
  });

  it("parses valid key config", () => {
    process.env.MCP_API_KEYS = JSON.stringify([
      {
        key: "vt_mcp_1",
        name: "host",
        organizationId: "org_1",
        actorId: "actor_1",
        permissions: ["cms:read"],
      },
    ]);
    expect(parseMcpApiKeys()).toHaveLength(1);
    expect(parseMcpApiKeys()[0].permissions).toEqual(["cms:read"]);
  });

  it("throws on malformed JSON", () => {
    process.env.MCP_API_KEYS = "{bad";
    expect(() => parseMcpApiKeys()).toThrow(/MCP_API_KEYS/);
  });
});

describe("authenticateMcpRequest", () => {
  it("rejects when server is disabled", () => {
    process.env.MCP_SERVER_ENABLED = "false";
    const result = authenticateMcpRequest(
      headers({ authorization: "Bearer vt_mcp_1" }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected auth failure");
    expect(result.error.code).toBe("mcp_disabled");
  });

  it("rejects missing API key", () => {
    process.env.MCP_SERVER_ENABLED = "true";
    process.env.MCP_API_KEYS = "[]";
    const result = authenticateMcpRequest(headers({}));
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected auth failure");
    expect(result.error.code).toBe("unauthorized");
  });

  it("accepts bearer API key", () => {
    process.env.MCP_SERVER_ENABLED = "true";
    process.env.MCP_API_KEYS = JSON.stringify([
      {
        key: "vt_mcp_1",
        name: "host",
        organizationId: "org_1",
        actorId: "actor_1",
        permissions: ["cms:read"],
      },
    ]);
    const result = authenticateMcpRequest(
      headers({ authorization: "Bearer vt_mcp_1" }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected auth success");
    expect(result.context.organizationId).toBe("org_1");
    expect(result.context.actorType).toBe("api_key");
    expect(result.context.permissions).toEqual(["cms:read"]);
  });

  it("accepts x-api-key", () => {
    process.env.MCP_SERVER_ENABLED = "true";
    process.env.MCP_API_KEYS = JSON.stringify([
      {
        key: "vt_mcp_2",
        name: "host",
        organizationId: "org_2",
        actorId: "actor_2",
        permissions: ["cms:sync"],
      },
    ]);
    const result = authenticateMcpRequest(headers({ "x-api-key": "vt_mcp_2" }));
    expect(result.ok).toBe(true);
  });
});
