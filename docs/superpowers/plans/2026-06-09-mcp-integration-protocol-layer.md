# MCP Integration Protocol Layer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a generic third-party API adapter framework, expose CMS as the first authenticated Streamable HTTP MCP tool set, and bridge the same tools into VibeTide's internal agent tool-calling path.

**Architecture:** Add a deterministic `src/lib/integrations` adapter layer with typed manifests, schemas, permissions, audit hooks, and result envelopes. Implement a CMS adapter that delegates to the existing `@/lib/cms` and CMS DAL modules, then expose it through a standalone Express-based MCP Streamable HTTP server and an internal Vercel AI SDK bridge.

**Tech Stack:** TypeScript, Zod v4, Vercel AI SDK tools, MCP TypeScript SDK, Express, Drizzle ORM, Vitest, existing BullMQ/CMS modules.

---

## File Structure

Create these files:

- `src/lib/integrations/types.ts`  
  Shared adapter manifest, tool definition, execution context, permission, and result envelope types.

- `src/lib/integrations/errors.ts`  
  Small helpers for normalized adapter errors and permission-denied results.

- `src/lib/integrations/registry.ts`  
  Registry helpers for listing tools, resolving adapter tools, validating permissions, and executing tools with a shared guard path.

- `src/lib/integrations/audit.ts`  
  Input summarization and invocation audit writer. This module should degrade gracefully if audit persistence fails.

- `src/lib/integrations/__tests__/registry.test.ts`  
  Unit coverage for permission checks, unknown tools, and successful execution.

- `src/lib/mcp/auth.ts`  
  API Key parsing from `MCP_API_KEYS`, bearer/header extraction, and MCP request context creation.

- `src/lib/mcp/server.ts`  
  Builds an `McpServer`, registers adapter tools, converts adapter envelopes to MCP structured tool results.

- `src/lib/mcp/__tests__/auth.test.ts`  
  Unit coverage for disabled server, missing key, invalid key, and permission context.

- `src/lib/mcp/__tests__/server.test.ts`  
  Unit coverage that the MCP server registers tools and wraps tool errors with `isError`.

- `src/lib/integrations/cms/manifest.ts`  
  CMS adapter metadata and permission model.

- `src/lib/integrations/cms/tools.ts`  
  Zod schemas for four CMS MVP tools.

- `src/lib/integrations/cms/executor.ts`  
  CMS adapter executor that calls `publishArticleToCms`, `syncCmsCatalogs`, `getPublicationById`, and listing DAL.

- `src/lib/integrations/cms/index.ts`  
  Single export for `cmsAdapter`.

- `src/lib/integrations/cms/__tests__/executor.test.ts`  
  Unit tests with mocked CMS/DAL calls.

- `src/db/schema/mcp.ts`  
  Drizzle table for `mcp_tool_invocations`.

- `src/lib/dal/mcp-tool-invocations.ts`  
  Persistence helper for generic MCP/integration invocation audit records.

- `supabase/migrations/20260609000001_mcp_tool_invocations.sql`  
  SQL migration matching the Drizzle schema.

- `src/lib/agent/tools/integration-bridge.ts`  
  Converts adapter tools into Vercel AI SDK `ToolSet` entries with underscore aliases.

- `src/lib/agent/tools/integration-bridge.test.ts`  
  Unit coverage for alias mapping and permission-preserving execution.

- `scripts/mcp-server.ts`  
  Standalone Express-based Streamable HTTP MCP server using the official MCP TypeScript SDK transport.

Modify these files:

- `package.json`  
  Add MCP/Express dependencies and `mcp` scripts.

- `src/db/schema/index.ts`  
  Export `./mcp`.

- `src/lib/dal/cms-publications.ts`  
  Add organization-scoped recent publication listing helper.

- `src/lib/agent/tool-registry.ts`  
  Merge integration bridge tools into `toVercelTools`.

- `src/lib/agent/execution.ts`  
  Pass organization/employee context into integration bridge creation if needed by the final `toVercelTools` signature.

- `.env.example` if present; otherwise `README.md`  
  Document `MCP_SERVER_ENABLED`, `MCP_API_KEYS`, and `MCP_PORT`.

Do not modify `src/lib/cms` business logic unless tests reveal a type mismatch that blocks delegation.

---

## Task 1: Install MCP Server Dependencies

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`

- [ ] **Step 1: Add runtime dependencies**

Run:

```bash
npm install @modelcontextprotocol/sdk express
```

Expected: `package.json` gains `@modelcontextprotocol/sdk` and `express`; `package-lock.json` updates.

- [ ] **Step 2: Add Express type dependency**

Run:

```bash
npm install -D @types/express
```

Expected: `package.json` gains `@types/express` in `devDependencies`.

- [ ] **Step 3: Add MCP scripts**

Modify `package.json` scripts to include:

```json
{
  "mcp": "tsx scripts/mcp-server.ts",
  "mcp:dev": "tsx watch scripts/mcp-server.ts"
}
```

Keep the existing scripts unchanged.

- [ ] **Step 4: Verify package metadata**

Run:

```bash
npm pkg get scripts.mcp scripts.mcp:dev dependencies.@modelcontextprotocol/sdk dependencies.express devDependencies.@types/express
```

Expected: JSON output contains the two scripts and all three package entries.

- [ ] **Step 5: Commit dependency changes**

```bash
git add package.json package-lock.json
git commit -m "chore: add mcp server dependencies"
```

---

## Task 2: Add Integration Adapter Core

**Files:**
- Create: `src/lib/integrations/types.ts`
- Create: `src/lib/integrations/errors.ts`
- Create: `src/lib/integrations/registry.ts`
- Create: `src/lib/integrations/__tests__/registry.test.ts`

- [ ] **Step 1: Write failing registry tests**

Create `src/lib/integrations/__tests__/registry.test.ts`:

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm test -- src/lib/integrations/__tests__/registry.test.ts
```

Expected: FAIL because `../registry` and `../types` do not exist.

- [ ] **Step 3: Create adapter types**

Create `src/lib/integrations/types.ts`:

```ts
import type { z } from "zod";

export type AdapterActorType = "user" | "agent" | "api_key";
export type AdapterSource = "mcp" | "agent" | "server_action";
export type AdapterAuthMode = "none" | "env" | "oauth" | "api_key";

export interface AdapterExecutionContext {
  organizationId: string;
  actorId: string;
  actorType: AdapterActorType;
  requestId: string;
  source: AdapterSource;
  permissions: string[];
}

export interface AdapterToolManifest {
  name: string;
  title: string;
  description: string;
  permissions: string[];
  destructive: boolean;
  audit: boolean;
}

export interface AdapterManifest {
  id: string;
  displayName: string;
  version: string;
  authMode: AdapterAuthMode;
  tools: AdapterToolManifest[];
}

export interface AdapterToolDefinition<
  TInput extends z.ZodTypeAny = z.ZodTypeAny,
  TOutput extends z.ZodTypeAny = z.ZodTypeAny,
> {
  name: string;
  title: string;
  description: string;
  inputSchema: TInput;
  outputSchema?: TOutput;
}

export interface AdapterToolError {
  code: string;
  message: string;
  retriable?: boolean;
  stage?: string;
}

export interface AdapterToolResult<T = unknown> {
  ok: boolean;
  data?: T;
  error?: AdapterToolError;
  audit?: Record<string, unknown>;
  requestId?: string;
}

export interface IntegrationAdapter {
  manifest: AdapterManifest;
  tools: AdapterToolDefinition[];
  execute(
    toolName: string,
    input: unknown,
    context: AdapterExecutionContext,
  ): Promise<AdapterToolResult>;
}

export interface RegisteredIntegrationTool {
  adapterId: string;
  manifest: AdapterToolManifest;
  definition: AdapterToolDefinition;
  name: string;
  title: string;
  description: string;
}
```

- [ ] **Step 4: Create error helpers**

Create `src/lib/integrations/errors.ts`:

```ts
import type { AdapterToolError, AdapterToolResult } from "./types";

export function adapterError(
  code: string,
  message: string,
  options: { retriable?: boolean; stage?: string } = {},
): AdapterToolError {
  return { code, message, ...options };
}

export function adapterFailure<T = unknown>(
  code: string,
  message: string,
  options: { retriable?: boolean; stage?: string; requestId?: string } = {},
): AdapterToolResult<T> {
  return {
    ok: false,
    error: adapterError(code, message, options),
    requestId: options.requestId,
  };
}

export function permissionDenied(
  permission: string,
  requestId?: string,
): AdapterToolResult {
  return adapterFailure(
    "permission_denied",
    `Missing required permission: ${permission}`,
    { retriable: false, stage: "auth", requestId },
  );
}
```

- [ ] **Step 5: Create registry implementation**

Create `src/lib/integrations/registry.ts`:

```ts
import type {
  AdapterExecutionContext,
  AdapterToolManifest,
  IntegrationAdapter,
  RegisteredIntegrationTool,
} from "./types";
import { adapterFailure, permissionDenied } from "./errors";

function findToolManifest(
  adapter: IntegrationAdapter,
  toolName: string,
): AdapterToolManifest | undefined {
  return adapter.manifest.tools.find((tool) => tool.name === toolName);
}

export function listIntegrationTools(
  adapters: IntegrationAdapter[],
): RegisteredIntegrationTool[] {
  return adapters.flatMap((adapter) =>
    adapter.tools.map((definition) => {
      const manifest = findToolManifest(adapter, definition.name);
      if (!manifest) {
        throw new Error(
          `Adapter ${adapter.manifest.id} is missing manifest metadata for tool ${definition.name}`,
        );
      }
      return {
        adapterId: adapter.manifest.id,
        manifest,
        definition,
        name: definition.name,
        title: definition.title,
        description: definition.description,
      };
    }),
  );
}

export function resolveIntegrationTool(
  adapters: IntegrationAdapter[],
  toolName: string,
) {
  for (const adapter of adapters) {
    const definition = adapter.tools.find((tool) => tool.name === toolName);
    if (!definition) continue;
    const manifest = findToolManifest(adapter, toolName);
    if (!manifest) {
      return {
        error: adapterFailure(
          "tool_manifest_missing",
          `Tool ${toolName} is registered without manifest metadata`,
          { retriable: false, stage: "registry" },
        ),
      };
    }
    return { adapter, definition, manifest };
  }
  return {
    error: adapterFailure(
      "tool_not_found",
      `Integration tool not found: ${toolName}`,
      { retriable: false, stage: "registry" },
    ),
  };
}

function hasPermission(context: AdapterExecutionContext, permission: string) {
  return context.permissions.includes(permission);
}

export async function executeIntegrationTool(
  adapters: IntegrationAdapter[],
  toolName: string,
  input: unknown,
  context: AdapterExecutionContext,
) {
  const resolved = resolveIntegrationTool(adapters, toolName);
  if ("error" in resolved) {
    return { ...resolved.error, requestId: context.requestId };
  }

  for (const permission of resolved.manifest.permissions) {
    if (!hasPermission(context, permission)) {
      return permissionDenied(permission, context.requestId);
    }
  }

  const parsed = resolved.definition.inputSchema.safeParse(input);
  if (!parsed.success) {
    return adapterFailure(
      "invalid_input",
      parsed.error.message,
      { retriable: false, stage: "validation", requestId: context.requestId },
    );
  }

  try {
    const result = await resolved.adapter.execute(
      toolName,
      parsed.data,
      context,
    );
    return { ...result, requestId: result.requestId ?? context.requestId };
  } catch (err) {
    return adapterFailure(
      "adapter_execution_failed",
      err instanceof Error ? err.message : String(err),
      { retriable: false, stage: "execution", requestId: context.requestId },
    );
  }
}
```

- [ ] **Step 6: Run registry tests**

Run:

```bash
npm test -- src/lib/integrations/__tests__/registry.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit integration core**

```bash
git add src/lib/integrations/types.ts src/lib/integrations/errors.ts src/lib/integrations/registry.ts src/lib/integrations/__tests__/registry.test.ts
git commit -m "feat: add integration adapter registry"
```

---

## Task 3: Add MCP API Key Authentication

**Files:**
- Create: `src/lib/mcp/auth.ts`
- Create: `src/lib/mcp/__tests__/auth.test.ts`

- [ ] **Step 1: Write failing auth tests**

Create `src/lib/mcp/__tests__/auth.test.ts`:

```ts
import { afterEach, describe, expect, it } from "vitest";
import {
  authenticateMcpRequest,
  parseMcpApiKeys,
} from "../auth";

const OLD_ENV = { ...process.env };

afterEach(() => {
  process.env = { ...OLD_ENV };
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
    const result = authenticateMcpRequest(headers({ authorization: "Bearer vt_mcp_1" }));
    expect(result.ok).toBe(false);
    expect(result.error.code).toBe("mcp_disabled");
  });

  it("rejects missing API key", () => {
    process.env.MCP_SERVER_ENABLED = "true";
    process.env.MCP_API_KEYS = "[]";
    const result = authenticateMcpRequest(headers({}));
    expect(result.ok).toBe(false);
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
    const result = authenticateMcpRequest(headers({ authorization: "Bearer vt_mcp_1" }));
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
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm test -- src/lib/mcp/__tests__/auth.test.ts
```

Expected: FAIL because `../auth` does not exist.

- [ ] **Step 3: Implement MCP auth**

Create `src/lib/mcp/auth.ts`:

```ts
import { randomUUID } from "crypto";
import { z } from "zod";
import type { AdapterExecutionContext } from "@/lib/integrations/types";

const McpApiKeySchema = z.object({
  key: z.string().min(1),
  name: z.string().min(1),
  organizationId: z.string().min(1),
  actorId: z.string().min(1),
  permissions: z.array(z.string().min(1)).default([]),
});

export type McpApiKeyConfig = z.infer<typeof McpApiKeySchema>;

export type McpAuthResult =
  | { ok: true; context: AdapterExecutionContext; keyName: string }
  | { ok: false; error: { code: string; message: string; status: number } };

export function parseMcpApiKeys(): McpApiKeyConfig[] {
  const raw = process.env.MCP_API_KEYS;
  if (!raw) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error(
      `MCP_API_KEYS must be a JSON array: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  const result = z.array(McpApiKeySchema).safeParse(parsed);
  if (!result.success) {
    throw new Error(`MCP_API_KEYS shape is invalid: ${result.error.message}`);
  }
  return result.data;
}

function extractApiKey(headers: Headers): string | null {
  const authorization = headers.get("authorization");
  if (authorization?.toLowerCase().startsWith("bearer ")) {
    return authorization.slice("bearer ".length).trim();
  }
  return headers.get("x-api-key")?.trim() || null;
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
    return {
      ok: false,
      error: {
        code: "unauthorized",
        message: "Missing MCP API key",
        status: 401,
      },
    };
  }

  const matched = parseMcpApiKeys().find((item) => item.key === apiKey);
  if (!matched) {
    return {
      ok: false,
      error: {
        code: "unauthorized",
        message: "Invalid MCP API key",
        status: 401,
      },
    };
  }

  return {
    ok: true,
    keyName: matched.name,
    context: {
      organizationId: matched.organizationId,
      actorId: matched.actorId,
      actorType: "api_key",
      requestId: randomUUID(),
      source: "mcp",
      permissions: matched.permissions,
    },
  };
}
```

- [ ] **Step 4: Run auth tests**

Run:

```bash
npm test -- src/lib/mcp/__tests__/auth.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit MCP auth**

```bash
git add src/lib/mcp/auth.ts src/lib/mcp/__tests__/auth.test.ts
git commit -m "feat: add mcp api key authentication"
```

---

## Task 4: Add CMS Adapter

**Files:**
- Create: `src/lib/integrations/cms/manifest.ts`
- Create: `src/lib/integrations/cms/tools.ts`
- Create: `src/lib/integrations/cms/executor.ts`
- Create: `src/lib/integrations/cms/index.ts`
- Create: `src/lib/integrations/cms/__tests__/executor.test.ts`
- Modify: `src/lib/dal/cms-publications.ts`

- [ ] **Step 1: Add recent publication DAL test by exercising adapter behavior**

Create `src/lib/integrations/cms/__tests__/executor.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { cmsAdapter } from "../index";
import type { AdapterExecutionContext } from "@/lib/integrations/types";

vi.mock("@/lib/cms", () => ({
  publishArticleToCms: vi.fn(async (input) => ({
    success: true,
    publicationId: "pub_1",
    cmsArticleId: "1001",
    cmsState: "submitted",
    timings: { totalMs: 10, mappingMs: 2, httpMs: 8 },
    input,
  })),
  syncCmsCatalogs: vi.fn(async (_organizationId, input) => ({
    success: true,
    syncLogId: "sync_1",
    stats: { catalogsFetched: 1 },
    warnings: [],
    input,
  })),
}));

vi.mock("@/lib/dal/cms-publications", () => ({
  getPublicationById: vi.fn(async (id: string) => ({
    id,
    organizationId: "org_1",
    articleId: "article_1",
    cmsArticleId: "1001",
    cmsCatalogId: "10210",
    cmsSiteId: 81,
    cmsState: "submitted",
    attempts: 1,
    previewUrl: "https://preview",
    publishedUrl: "https://published",
    errorCode: null,
    errorMessage: null,
    createdAt: new Date("2026-06-09T00:00:00Z"),
    updatedAt: new Date("2026-06-09T00:01:00Z"),
  })),
  listRecentPublicationsByOrg: vi.fn(async () => [
    {
      id: "pub_1",
      organizationId: "org_1",
      articleId: "article_1",
      cmsArticleId: "1001",
      cmsCatalogId: "10210",
      cmsSiteId: 81,
      cmsState: "submitted",
      attempts: 1,
      previewUrl: "https://preview",
      publishedUrl: "https://published",
      errorCode: null,
      errorMessage: null,
      createdAt: new Date("2026-06-09T00:00:00Z"),
      updatedAt: new Date("2026-06-09T00:01:00Z"),
    },
  ]),
}));

const context: AdapterExecutionContext = {
  organizationId: "org_1",
  actorId: "agent-xiaofa",
  actorType: "agent",
  requestId: "req_1",
  source: "agent",
  permissions: ["cms:publish", "cms:sync", "cms:read"],
};

describe("cmsAdapter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("declares four tools", () => {
    expect(cmsAdapter.tools.map((tool) => tool.name)).toEqual([
      "cms.publish_article",
      "cms.sync_catalogs",
      "cms.get_publication_status",
      "cms.list_recent_publications",
    ]);
  });

  it("publishes articles through existing CMS workflow", async () => {
    const result = await cmsAdapter.execute(
      "cms.publish_article",
      { articleId: "article_1", allowUpdate: false },
      context,
    );
    expect(result.ok).toBe(true);
    expect(result.data).toMatchObject({
      success: true,
      publicationId: "pub_1",
      cmsArticleId: "1001",
    });
  });

  it("syncs catalogs with deleteMissing defaulting false", async () => {
    const result = await cmsAdapter.execute(
      "cms.sync_catalogs",
      { dryRun: true },
      context,
    );
    expect(result.ok).toBe(true);
    expect(result.audit).toMatchObject({ dryRun: true, deleteMissing: false });
  });

  it("rejects deleteMissing without elevated permission", async () => {
    const result = await cmsAdapter.execute(
      "cms.sync_catalogs",
      { deleteMissing: true },
      context,
    );
    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe("permission_denied");
  });

  it("returns publication status scoped to organization", async () => {
    const result = await cmsAdapter.execute(
      "cms.get_publication_status",
      { publicationId: "pub_1" },
      context,
    );
    expect(result.ok).toBe(true);
    expect(result.data).toMatchObject({
      publicationId: "pub_1",
      articleId: "article_1",
      cmsState: "submitted",
    });
  });

  it("lists recent publications capped by schema", async () => {
    const result = await cmsAdapter.execute(
      "cms.list_recent_publications",
      { limit: 100 },
      context,
    );
    expect(result.ok).toBe(true);
    expect(result.data).toMatchObject({ count: 1 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm test -- src/lib/integrations/cms/__tests__/executor.test.ts
```

Expected: FAIL because the CMS adapter files do not exist.

- [ ] **Step 3: Add DAL listing helper**

Append to `src/lib/dal/cms-publications.ts`:

```ts
export async function listRecentPublicationsByOrg(
  organizationId: string,
  options: { state?: CmsPublicationState; limit?: number } = {},
) {
  const conditions = [eq(cmsPublications.organizationId, organizationId)];
  if (options.state) {
    conditions.push(eq(cmsPublications.cmsState, options.state));
  }

  return await db.query.cmsPublications.findMany({
    where: and(...conditions),
    orderBy: [desc(cmsPublications.createdAt)],
    limit: Math.min(Math.max(options.limit ?? 20, 1), 50),
  });
}
```

- [ ] **Step 4: Create CMS manifest**

Create `src/lib/integrations/cms/manifest.ts`:

```ts
import type { AdapterManifest } from "@/lib/integrations/types";

export const cmsAdapterManifest = {
  id: "cms",
  displayName: "Huaqiyun CMS",
  version: "1.0.0",
  authMode: "env",
  tools: [
    {
      name: "cms.publish_article",
      title: "Publish Article to CMS",
      description: "Publish an approved VibeTide article into CMS",
      permissions: ["cms:publish"],
      destructive: false,
      audit: true,
    },
    {
      name: "cms.sync_catalogs",
      title: "Sync CMS Catalogs",
      description: "Sync CMS channels, applications, and catalogs into VibeTide",
      permissions: ["cms:sync"],
      destructive: false,
      audit: true,
    },
    {
      name: "cms.get_publication_status",
      title: "Get CMS Publication Status",
      description: "Read one CMS publication record by publication ID",
      permissions: ["cms:read"],
      destructive: false,
      audit: true,
    },
    {
      name: "cms.list_recent_publications",
      title: "List Recent CMS Publications",
      description: "List recent CMS publication records for the current organization",
      permissions: ["cms:read"],
      destructive: false,
      audit: true,
    },
  ],
} satisfies AdapterManifest;
```

- [ ] **Step 5: Create CMS tool schemas**

Create `src/lib/integrations/cms/tools.ts`:

```ts
import { z } from "zod";
import type { AdapterToolDefinition } from "@/lib/integrations/types";

export const CmsPublishArticleInputSchema = z.object({
  articleId: z.string().min(1),
  allowUpdate: z.boolean().optional(),
  triggerSource: z
    .enum(["workflow", "manual", "scheduled", "daily_plan"])
    .optional(),
});

export const CmsSyncCatalogsInputSchema = z.object({
  dryRun: z.boolean().optional(),
  deleteMissing: z.boolean().optional(),
});

export const CmsGetPublicationStatusInputSchema = z.object({
  publicationId: z.string().min(1),
});

export const CmsListRecentPublicationsInputSchema = z.object({
  state: z
    .enum(["submitting", "submitted", "synced", "rejected_by_cms", "failed", "retrying"])
    .optional(),
  limit: z.number().int().min(1).max(50).optional(),
});

export type CmsPublishArticleInput = z.infer<typeof CmsPublishArticleInputSchema>;
export type CmsSyncCatalogsInput = z.infer<typeof CmsSyncCatalogsInputSchema>;
export type CmsGetPublicationStatusInput = z.infer<typeof CmsGetPublicationStatusInputSchema>;
export type CmsListRecentPublicationsInput = z.infer<typeof CmsListRecentPublicationsInputSchema>;

export const cmsAdapterTools: AdapterToolDefinition[] = [
  {
    name: "cms.publish_article",
    title: "Publish Article to CMS",
    description: "Publish an approved VibeTide article into CMS",
    inputSchema: CmsPublishArticleInputSchema,
  },
  {
    name: "cms.sync_catalogs",
    title: "Sync CMS Catalogs",
    description: "Sync CMS channels, applications, and catalogs into VibeTide",
    inputSchema: CmsSyncCatalogsInputSchema,
  },
  {
    name: "cms.get_publication_status",
    title: "Get CMS Publication Status",
    description: "Read one CMS publication record by publication ID",
    inputSchema: CmsGetPublicationStatusInputSchema,
  },
  {
    name: "cms.list_recent_publications",
    title: "List Recent CMS Publications",
    description: "List recent CMS publication records for the current organization",
    inputSchema: CmsListRecentPublicationsInputSchema,
  },
];
```

- [ ] **Step 6: Create CMS executor**

Create `src/lib/integrations/cms/executor.ts`:

```ts
import { publishArticleToCms, syncCmsCatalogs } from "@/lib/cms";
import {
  getPublicationById,
  listRecentPublicationsByOrg,
} from "@/lib/dal/cms-publications";
import { adapterFailure } from "@/lib/integrations/errors";
import type {
  AdapterExecutionContext,
  AdapterToolResult,
} from "@/lib/integrations/types";
import type {
  CmsGetPublicationStatusInput,
  CmsListRecentPublicationsInput,
  CmsPublishArticleInput,
  CmsSyncCatalogsInput,
} from "./tools";

function serializeDate(value: Date | string | null | undefined) {
  if (!value) return undefined;
  return value instanceof Date ? value.toISOString() : value;
}

function summarizePublication(row: any) {
  return {
    publicationId: row.id,
    articleId: row.articleId,
    cmsArticleId: row.cmsArticleId ?? undefined,
    cmsCatalogId: row.cmsCatalogId ?? undefined,
    cmsSiteId: row.cmsSiteId ?? undefined,
    cmsState: row.cmsState,
    attempts: row.attempts ?? 0,
    previewUrl: row.previewUrl ?? undefined,
    publishedUrl: row.publishedUrl ?? undefined,
    errorCode: row.errorCode ?? undefined,
    errorMessage: row.errorMessage ?? undefined,
    createdAt: serializeDate(row.createdAt),
    updatedAt: serializeDate(row.updatedAt),
  };
}

export async function executeCmsTool(
  toolName: string,
  input: unknown,
  context: AdapterExecutionContext,
): Promise<AdapterToolResult> {
  switch (toolName) {
    case "cms.publish_article": {
      const typed = input as CmsPublishArticleInput;
      const data = await publishArticleToCms({
        articleId: typed.articleId,
        operatorId: context.actorId,
        triggerSource: typed.triggerSource ?? "workflow",
        allowUpdate: typed.allowUpdate,
      });
      return {
        ok: true,
        data,
        audit: {
          articleId: typed.articleId,
          publicationId: data.publicationId,
          cmsArticleId: data.cmsArticleId,
          cmsState: data.cmsState,
        },
      };
    }

    case "cms.sync_catalogs": {
      const typed = input as CmsSyncCatalogsInput;
      const deleteMissing = typed.deleteMissing === true;
      if (
        deleteMissing &&
        !context.permissions.includes("cms:sync:delete_missing")
      ) {
        return adapterFailure(
          "permission_denied",
          "Missing required permission: cms:sync:delete_missing",
          { retriable: false, stage: "auth", requestId: context.requestId },
        );
      }

      const data = await syncCmsCatalogs(context.organizationId, {
        triggerSource: "mcp",
        operatorId: context.actorId,
        dryRun: typed.dryRun,
        deleteMissing,
      });
      return {
        ok: true,
        data,
        audit: {
          syncLogId: data.syncLogId,
          dryRun: typed.dryRun === true,
          deleteMissing,
        },
      };
    }

    case "cms.get_publication_status": {
      const typed = input as CmsGetPublicationStatusInput;
      const row = await getPublicationById(typed.publicationId);
      if (!row) {
        return adapterFailure(
          "publication_not_found",
          `Publication not found: ${typed.publicationId}`,
          { retriable: false, stage: "read", requestId: context.requestId },
        );
      }
      if (row.organizationId !== context.organizationId) {
        return adapterFailure(
          "permission_denied",
          "Publication belongs to another organization",
          { retriable: false, stage: "auth", requestId: context.requestId },
        );
      }
      return {
        ok: true,
        data: summarizePublication(row),
        audit: { publicationId: typed.publicationId },
      };
    }

    case "cms.list_recent_publications": {
      const typed = input as CmsListRecentPublicationsInput;
      const rows = await listRecentPublicationsByOrg(context.organizationId, {
        state: typed.state,
        limit: typed.limit ?? 20,
      });
      const publications = rows.map(summarizePublication);
      return {
        ok: true,
        data: {
          count: publications.length,
          publications,
        },
        audit: {
          state: typed.state ?? "all",
          limit: typed.limit ?? 20,
        },
      };
    }

    default:
      return adapterFailure(
        "tool_not_found",
        `CMS tool not found: ${toolName}`,
        { retriable: false, stage: "registry", requestId: context.requestId },
      );
  }
}
```

- [ ] **Step 7: Create CMS adapter export**

Create `src/lib/integrations/cms/index.ts`:

```ts
import type { IntegrationAdapter } from "@/lib/integrations/types";
import { cmsAdapterManifest } from "./manifest";
import { cmsAdapterTools } from "./tools";
import { executeCmsTool } from "./executor";

export const cmsAdapter: IntegrationAdapter = {
  manifest: cmsAdapterManifest,
  tools: cmsAdapterTools,
  execute: executeCmsTool,
};

export { cmsAdapterManifest } from "./manifest";
export { cmsAdapterTools } from "./tools";
```

- [ ] **Step 8: Run CMS adapter tests**

Run:

```bash
npm test -- src/lib/integrations/cms/__tests__/executor.test.ts
```

Expected: PASS.

- [ ] **Step 9: Commit CMS adapter**

```bash
git add src/lib/dal/cms-publications.ts src/lib/integrations/cms
git commit -m "feat: add cms integration adapter"
```

---

## Task 5: Add MCP Invocation Audit Persistence

**Files:**
- Create: `src/db/schema/mcp.ts`
- Modify: `src/db/schema/index.ts`
- Create: `supabase/migrations/20260609000001_mcp_tool_invocations.sql`
- Create: `src/lib/dal/mcp-tool-invocations.ts`
- Create: `src/lib/integrations/audit.ts`
- Create: `src/lib/integrations/__tests__/audit.test.ts`

- [ ] **Step 1: Write failing audit summarization tests**

Create `src/lib/integrations/__tests__/audit.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { summarizeIntegrationInput } from "../audit";

describe("summarizeIntegrationInput", () => {
  it("keeps bounded primitive fields", () => {
    expect(
      summarizeIntegrationInput({
        articleId: "article_1",
        allowUpdate: true,
        limit: 20,
      }),
    ).toEqual({
      articleId: "article_1",
      allowUpdate: true,
      limit: 20,
    });
  });

  it("redacts sensitive and large content fields", () => {
    expect(
      summarizeIntegrationInput({
        apiKey: "secret",
        authorization: "Bearer secret",
        body: "<p>long html</p>",
        requestPayload: { deep: true },
      }),
    ).toEqual({
      apiKey: "[redacted]",
      authorization: "[redacted]",
      body: "[redacted_content]",
      requestPayload: "[redacted_content]",
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm test -- src/lib/integrations/__tests__/audit.test.ts
```

Expected: FAIL because `../audit` does not exist.

- [ ] **Step 3: Add Drizzle schema**

Create `src/db/schema/mcp.ts`:

```ts
import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { organizations } from "./users";

export const mcpToolInvocations = pgTable(
  "mcp_tool_invocations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    requestId: text("request_id").notNull(),
    adapterId: text("adapter_id").notNull(),
    toolName: text("tool_name").notNull(),
    organizationId: uuid("organization_id")
      .references(() => organizations.id)
      .notNull(),
    actorId: text("actor_id").notNull(),
    actorType: text("actor_type").notNull(),
    source: text("source").notNull(),
    inputSummary: jsonb("input_summary").$type<Record<string, unknown>>(),
    resultStatus: text("result_status").notNull(),
    errorCode: text("error_code"),
    durationMs: integer("duration_ms"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    requestIdx: index("mcp_tool_invocations_request_idx").on(table.requestId),
    orgCreatedIdx: index("mcp_tool_invocations_org_created_idx").on(
      table.organizationId,
      table.createdAt,
    ),
    toolCreatedIdx: index("mcp_tool_invocations_tool_created_idx").on(
      table.toolName,
      table.createdAt,
    ),
  }),
);

export const mcpToolInvocationsRelations = relations(
  mcpToolInvocations,
  ({ one }) => ({
    organization: one(organizations, {
      fields: [mcpToolInvocations.organizationId],
      references: [organizations.id],
    }),
  }),
);
```

Modify `src/db/schema/index.ts` by adding:

```ts
// MCP / integration protocol invocation audit (2026-06-09)
export * from "./mcp";
```

- [ ] **Step 4: Add SQL migration**

Create `supabase/migrations/20260609000001_mcp_tool_invocations.sql`:

```sql
create table if not exists public.mcp_tool_invocations (
  id uuid primary key default gen_random_uuid(),
  request_id text not null,
  adapter_id text not null,
  tool_name text not null,
  organization_id uuid not null references public.organizations(id),
  actor_id text not null,
  actor_type text not null,
  source text not null,
  input_summary jsonb,
  result_status text not null,
  error_code text,
  duration_ms integer,
  created_at timestamptz not null default now()
);

create index if not exists mcp_tool_invocations_request_idx
  on public.mcp_tool_invocations(request_id);

create index if not exists mcp_tool_invocations_org_created_idx
  on public.mcp_tool_invocations(organization_id, created_at);

create index if not exists mcp_tool_invocations_tool_created_idx
  on public.mcp_tool_invocations(tool_name, created_at);
```

- [ ] **Step 5: Add audit DAL**

Create `src/lib/dal/mcp-tool-invocations.ts`:

```ts
import { db } from "@/db";
import { mcpToolInvocations } from "@/db/schema";
import type {
  AdapterActorType,
  AdapterSource,
} from "@/lib/integrations/types";

export interface CreateMcpToolInvocationInput {
  requestId: string;
  adapterId: string;
  toolName: string;
  organizationId: string;
  actorId: string;
  actorType: AdapterActorType;
  source: AdapterSource;
  inputSummary?: Record<string, unknown>;
  resultStatus: "success" | "error";
  errorCode?: string;
  durationMs?: number;
}

export async function createMcpToolInvocation(
  input: CreateMcpToolInvocationInput,
): Promise<void> {
  await db.insert(mcpToolInvocations).values({
    requestId: input.requestId,
    adapterId: input.adapterId,
    toolName: input.toolName,
    organizationId: input.organizationId,
    actorId: input.actorId,
    actorType: input.actorType,
    source: input.source,
    inputSummary: input.inputSummary,
    resultStatus: input.resultStatus,
    errorCode: input.errorCode,
    durationMs: input.durationMs,
  });
}
```

- [ ] **Step 6: Add integration audit helper**

Create `src/lib/integrations/audit.ts`:

```ts
import { createMcpToolInvocation } from "@/lib/dal/mcp-tool-invocations";
import type {
  AdapterExecutionContext,
  AdapterToolResult,
  RegisteredIntegrationTool,
} from "./types";

const SENSITIVE_KEY_RE = /(api[-_]?key|authorization|token|secret|password|credential)/i;
const CONTENT_KEY_RE = /(body|html|content|requestPayload|responsePayload)/i;

export function summarizeIntegrationInput(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { value: typeof input };
  }

  const summary: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    if (SENSITIVE_KEY_RE.test(key)) {
      summary[key] = "[redacted]";
      continue;
    }
    if (CONTENT_KEY_RE.test(key)) {
      summary[key] = "[redacted_content]";
      continue;
    }
    if (
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean" ||
      value === null
    ) {
      summary[key] = typeof value === "string" && value.length > 200
        ? `${value.slice(0, 200)}...`
        : value;
      continue;
    }
    summary[key] = Array.isArray(value) ? `[array:${value.length}]` : "[object]";
  }
  return summary;
}

export async function auditIntegrationInvocation(params: {
  tool: RegisteredIntegrationTool;
  context: AdapterExecutionContext;
  input: unknown;
  result: AdapterToolResult;
  durationMs: number;
}): Promise<void> {
  if (!params.tool.manifest.audit) return;

  try {
    await createMcpToolInvocation({
      requestId: params.context.requestId,
      adapterId: params.tool.adapterId,
      toolName: params.tool.name,
      organizationId: params.context.organizationId,
      actorId: params.context.actorId,
      actorType: params.context.actorType,
      source: params.context.source,
      inputSummary: summarizeIntegrationInput(params.input),
      resultStatus: params.result.ok ? "success" : "error",
      errorCode: params.result.error?.code,
      durationMs: params.durationMs,
    });
  } catch (err) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(
        "[integrations] audit write failed:",
        err instanceof Error ? err.message : String(err),
      );
    }
  }
}
```

- [ ] **Step 7: Wire audit into registry execution**

Modify `src/lib/integrations/registry.ts` so `executeIntegrationTool` records audit after adapter execution and validation failures. Use this pattern after resolving the tool:

```ts
import { auditIntegrationInvocation } from "./audit";

// inside executeIntegrationTool, after resolved is successful:
const startedAt = performance.now();

// for every result path after this point:
await auditIntegrationInvocation({
  tool: {
    adapterId: resolved.adapter.manifest.id,
    manifest: resolved.manifest,
    definition: resolved.definition,
    name: resolved.definition.name,
    title: resolved.definition.title,
    description: resolved.definition.description,
  },
  context,
  input,
  result,
  durationMs: Math.round(performance.now() - startedAt),
});
```

Apply the same helper to invalid input and caught execution failures so audited tools record both success and failure.

- [ ] **Step 8: Run audit and registry tests**

Run:

```bash
npm test -- src/lib/integrations/__tests__/audit.test.ts src/lib/integrations/__tests__/registry.test.ts
```

Expected: PASS. If registry tests hit database writes, set the demo manifest `audit: false` in the test adapter as shown in Task 2.

- [ ] **Step 9: Commit audit persistence**

```bash
git add src/db/schema/mcp.ts src/db/schema/index.ts supabase/migrations/20260609000001_mcp_tool_invocations.sql src/lib/dal/mcp-tool-invocations.ts src/lib/integrations/audit.ts src/lib/integrations/__tests__/audit.test.ts src/lib/integrations/registry.ts
git commit -m "feat: audit integration tool invocations"
```

---

## Task 6: Add MCP Server Builder and Standalone HTTP Entry

**Files:**
- Create: `src/lib/mcp/server.ts`
- Create: `src/lib/mcp/__tests__/server.test.ts`
- Create: `scripts/mcp-server.ts`

- [ ] **Step 1: Write failing MCP server tests**

Create `src/lib/mcp/__tests__/server.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { buildMcpServer } from "../server";
import type { IntegrationAdapter } from "@/lib/integrations/types";

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
    ],
  },
  tools: [
    {
      name: "demo.echo",
      title: "Echo",
      description: "Echo text",
      inputSchema: z.object({ text: z.string() }),
    },
  ],
  execute: async (_toolName, input) => ({ ok: true, data: input }),
};

describe("buildMcpServer", () => {
  it("builds a server object", () => {
    const server = buildMcpServer({
      adapters: [adapter],
      context: {
        organizationId: "org_1",
        actorId: "actor_1",
        actorType: "api_key",
        requestId: "req_1",
        source: "mcp",
        permissions: ["demo:read"],
      },
    });
    expect(server).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm test -- src/lib/mcp/__tests__/server.test.ts
```

Expected: FAIL because `../server` does not exist.

- [ ] **Step 3: Implement MCP server builder**

Create `src/lib/mcp/server.ts`:

```ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { z } from "zod";
import {
  executeIntegrationTool,
  listIntegrationTools,
} from "@/lib/integrations/registry";
import type {
  AdapterExecutionContext,
  IntegrationAdapter,
} from "@/lib/integrations/types";

function toMcpResult(result: Awaited<ReturnType<typeof executeIntegrationTool>>) {
  const payload = {
    ...result,
    requestId: result.requestId,
  };

  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(payload, null, 2),
      },
    ],
    structuredContent: payload,
    isError: !result.ok,
  };
}

export function buildMcpServer(params: {
  adapters: IntegrationAdapter[];
  context: AdapterExecutionContext;
}) {
  const server = new McpServer({
    name: "vibetide-mcp",
    version: "0.1.0",
  });

  for (const registered of listIntegrationTools(params.adapters)) {
    server.registerTool(
      registered.name,
      {
        title: registered.title,
        description: registered.description,
        inputSchema: registered.definition.inputSchema.shape as z.ZodRawShape,
      },
      async (input) => {
        const result = await executeIntegrationTool(
          params.adapters,
          registered.name,
          input,
          params.context,
        );
        return toMcpResult(result);
      },
    );
  }

  return server;
}
```

If TypeScript reports that a schema has no `.shape`, change `AdapterToolDefinition` to require `inputSchema: z.ZodObject<z.ZodRawShape>` because all MVP tools use object schemas.

- [ ] **Step 4: Create standalone MCP server**

Create `scripts/mcp-server.ts`:

```ts
import type { Request, Response } from "express";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createMcpExpressApp } from "@modelcontextprotocol/sdk/server/express.js";
import { authenticateMcpRequest } from "@/lib/mcp/auth";
import { buildMcpServer } from "@/lib/mcp/server";
import { cmsAdapter } from "@/lib/integrations/cms";

const app = createMcpExpressApp();
const adapters = [cmsAdapter];

function toHeaders(req: Request) {
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (Array.isArray(value)) {
      headers.set(key, value.join(","));
    } else if (typeof value === "string") {
      headers.set(key, value);
    }
  }
  return headers;
}

app.post("/mcp", async (req: Request, res: Response) => {
  const auth = authenticateMcpRequest(toHeaders(req));
  if (!auth.ok) {
    res.status(auth.error.status).json({
      jsonrpc: "2.0",
      error: {
        code: -32001,
        message: auth.error.message,
        data: { code: auth.error.code },
      },
      id: null,
    });
    return;
  }

  const server = buildMcpServer({
    adapters,
    context: auth.context,
  });

  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  });

  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
    res.on("close", () => {
      transport.close();
      server.close();
    });
  } catch (err) {
    console.error("[mcp] request failed:", err);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: "2.0",
        error: { code: -32603, message: "Internal server error" },
        id: null,
      });
    }
  }
});

app.get("/mcp", (_req: Request, res: Response) => {
  res.status(405).json({
    jsonrpc: "2.0",
    error: { code: -32000, message: "Method not allowed" },
    id: null,
  });
});

app.delete("/mcp", (_req: Request, res: Response) => {
  res.status(405).json({
    jsonrpc: "2.0",
    error: { code: -32000, message: "Method not allowed" },
    id: null,
  });
});

const port = Number(process.env.MCP_PORT ?? "3033");
app.listen(port, (error?: Error) => {
  if (error) {
    console.error("[mcp] failed to start:", error);
    process.exit(1);
  }
  console.log(`[mcp] VibeTide MCP server listening on http://127.0.0.1:${port}/mcp`);
});
```

- [ ] **Step 5: Run server tests**

Run:

```bash
npm test -- src/lib/mcp/__tests__/server.test.ts src/lib/mcp/__tests__/auth.test.ts
```

Expected: PASS.

- [ ] **Step 6: Run TypeScript check through build or lint**

Run:

```bash
npm run lint -- src/lib/mcp src/lib/integrations scripts/mcp-server.ts
```

Expected: PASS or only pre-existing lint config warnings outside touched files.

- [ ] **Step 7: Commit MCP server**

```bash
git add src/lib/mcp/server.ts src/lib/mcp/__tests__/server.test.ts scripts/mcp-server.ts
git commit -m "feat: expose integrations through mcp server"
```

---

## Task 7: Add Internal Agent Integration Bridge

**Files:**
- Create: `src/lib/agent/tools/integration-bridge.ts`
- Create: `src/lib/agent/tools/integration-bridge.test.ts`
- Modify: `src/lib/agent/tool-registry.ts`
- Modify: `src/lib/agent/execution.ts`

- [ ] **Step 1: Write failing bridge tests**

Create `src/lib/agent/tools/integration-bridge.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { createIntegrationAgentTools } from "./integration-bridge";
import type { IntegrationAdapter } from "@/lib/integrations/types";

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
    ],
  },
  tools: [
    {
      name: "demo.echo",
      title: "Echo",
      description: "Echo text",
      inputSchema: z.object({ text: z.string() }),
    },
  ],
  execute: vi.fn(async (_toolName, input) => ({ ok: true, data: input })),
};

describe("createIntegrationAgentTools", () => {
  it("maps dot tool names to underscore aliases", () => {
    const tools = createIntegrationAgentTools({
      adapters: [adapter],
      context: {
        organizationId: "org_1",
        actorId: "employee_1",
        actorType: "agent",
        requestId: "req_1",
        source: "agent",
        permissions: ["demo:read"],
      },
    });
    expect(Object.keys(tools)).toEqual(["demo_echo"]);
  });

  it("does not expose tools without permissions", () => {
    const tools = createIntegrationAgentTools({
      adapters: [adapter],
      context: {
        organizationId: "org_1",
        actorId: "employee_1",
        actorType: "agent",
        requestId: "req_1",
        source: "agent",
        permissions: [],
      },
    });
    expect(Object.keys(tools)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm test -- src/lib/agent/tools/integration-bridge.test.ts
```

Expected: FAIL because `integration-bridge.ts` does not exist.

- [ ] **Step 3: Implement bridge**

Create `src/lib/agent/tools/integration-bridge.ts`:

```ts
import { tool, type ToolSet } from "ai";
import {
  executeIntegrationTool,
  listIntegrationTools,
} from "@/lib/integrations/registry";
import type {
  AdapterExecutionContext,
  IntegrationAdapter,
} from "@/lib/integrations/types";

export function toAgentToolAlias(toolName: string) {
  return toolName.replace(/[^a-zA-Z0-9_]/g, "_");
}

function hasAllPermissions(
  context: AdapterExecutionContext,
  permissions: string[],
) {
  return permissions.every((permission) =>
    context.permissions.includes(permission),
  );
}

export function createIntegrationAgentTools(params: {
  adapters: IntegrationAdapter[];
  context: AdapterExecutionContext;
}): ToolSet {
  const tools: ToolSet = {};

  for (const registered of listIntegrationTools(params.adapters)) {
    if (!hasAllPermissions(params.context, registered.manifest.permissions)) {
      continue;
    }

    tools[toAgentToolAlias(registered.name)] = tool({
      description: registered.description,
      inputSchema: registered.definition.inputSchema,
      execute: async (input) => {
        return await executeIntegrationTool(
          params.adapters,
          registered.name,
          input,
          params.context,
        );
      },
    });
  }

  return tools;
}
```

- [ ] **Step 4: Extend `toVercelTools` signature**

Modify `src/lib/agent/tool-registry.ts`:

```ts
import { randomUUID } from "crypto";
import { createIntegrationAgentTools } from "@/lib/agent/tools/integration-bridge";
import { cmsAdapter } from "@/lib/integrations/cms";
```

Change `toVercelTools` signature to accept an integration context:

```ts
export function toVercelTools(
  agentTools: AgentTool[],
  pluginConfigs?: Map<string, { description: string; config: PluginConfig }>,
  missionTools?: ToolSet,
  knowledgeBaseTools?: ToolSet,
  integrationContext?: {
    organizationId: string;
    actorId: string;
    permissions: string[];
  },
): ToolSet {
```

Before returning `result`, merge integration tools:

```ts
  if (integrationContext) {
    Object.assign(
      result,
      createIntegrationAgentTools({
        adapters: [cmsAdapter],
        context: {
          organizationId: integrationContext.organizationId,
          actorId: integrationContext.actorId,
          actorType: "agent",
          requestId: randomUUID(),
          source: "agent",
          permissions: integrationContext.permissions,
        },
      }),
    );
  }
```

- [ ] **Step 5: Add organization context to assembled agents**

Modify `src/lib/agent/types.ts` so `AssembledAgent` carries the organization loaded by `assembleAgent`:

```ts
organizationId?: string;
```

Modify `src/lib/agent/assembly.ts` inside the `const agent: AssembledAgent = { ... }` object:

```ts
    organizationId: employee.organizationId,
```

Modify `src/lib/agent/execution.ts` so the `toVercelTools` call includes organization and employee context:

```ts
  const integrationPermissions = agent.skillCategories.includes("system_interop")
    ? ["cms:publish", "cms:read"]
    : ["cms:read"];

  const vercelTools = toVercelTools(
    agent.tools,
    agent.pluginConfigs,
    missionTools,
    kbTools,
    agent.organizationId
      ? {
          organizationId: agent.organizationId,
          actorId: agent.employeeId,
          permissions: integrationPermissions,
        }
      : undefined,
  );
```

- [ ] **Step 6: Run bridge tests**

Run:

```bash
npm test -- src/lib/agent/tools/integration-bridge.test.ts
```

Expected: PASS.

- [ ] **Step 7: Run affected agent tests**

Run:

```bash
npm test -- src/lib/agent/tools/integration-bridge.test.ts src/lib/integrations/__tests__/registry.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit bridge**

```bash
git add src/lib/agent/tools/integration-bridge.ts src/lib/agent/tools/integration-bridge.test.ts src/lib/agent/tool-registry.ts src/lib/agent/execution.ts src/lib/agent/types.ts
git commit -m "feat: bridge integration tools into agents"
```

---

## Task 8: Document Environment and Verify End-to-End

**Files:**
- Modify: `README.md`
- Modify: `CLAUDE.md`

- [ ] **Step 1: Add README MCP section**

Append to `README.md`:

```md
## MCP Server

VibeTide exposes selected third-party API adapters through an internal MCP server.

Required environment:

```bash
MCP_SERVER_ENABLED=true
MCP_PORT=3033
MCP_API_KEYS='[
  {
    "key": "vt_mcp_local",
    "name": "local-dev",
    "organizationId": "00000000-0000-0000-0000-000000000001",
    "actorId": "mcp-local-dev",
    "permissions": ["cms:publish", "cms:sync", "cms:read"]
  }
]'
```

Run:

```bash
npm run mcp
```

Endpoint:

```text
POST http://127.0.0.1:3033/mcp
Authorization: Bearer vt_mcp_local
```

The first adapter is CMS. Published articles still flow through `src/lib/cms`, so `cms_publications`, retries, and status polling continue to work normally.
```

- [ ] **Step 2: Add CLAUDE architecture note**

Add under the CMS Integration Layer section in `CLAUDE.md`:

```md
### MCP Integration Protocol Layer

The MCP layer exposes third-party adapters without bypassing business services.

- Adapter contract: `src/lib/integrations/types.ts`
- CMS adapter: `src/lib/integrations/cms/`
- MCP auth/server: `src/lib/mcp/`, `scripts/mcp-server.ts`
- Internal agent bridge: `src/lib/agent/tools/integration-bridge.ts`

CMS MCP tools must delegate to `@/lib/cms`; do not add raw CMS HTTP proxy tools.
```

- [ ] **Step 3: Run focused test suite**

Run:

```bash
npm test -- \
  src/lib/integrations/__tests__/registry.test.ts \
  src/lib/integrations/__tests__/audit.test.ts \
  src/lib/integrations/cms/__tests__/executor.test.ts \
  src/lib/mcp/__tests__/auth.test.ts \
  src/lib/mcp/__tests__/server.test.ts \
  src/lib/agent/tools/integration-bridge.test.ts
```

Expected: PASS.

- [ ] **Step 4: Run lint**

Run:

```bash
npm run lint -- src/lib/integrations src/lib/mcp src/lib/agent/tools/integration-bridge.ts scripts/mcp-server.ts
```

Expected: PASS or only unrelated pre-existing lint warnings outside touched files.

- [ ] **Step 5: Run build**

Run:

```bash
npm run build
```

Expected: PASS. If build attempts database access and fails because local Supabase is not configured, record the exact error and confirm the TypeScript/lint/test steps passed.

- [ ] **Step 6: Smoke start MCP server**

Run with a local dummy key:

```bash
MCP_SERVER_ENABLED=true \
MCP_PORT=3033 \
MCP_API_KEYS='[{"key":"vt_mcp_local","name":"local-dev","organizationId":"00000000-0000-0000-0000-000000000001","actorId":"mcp-local-dev","permissions":["cms:read"]}]' \
npm run mcp
```

Expected: terminal prints:

```text
[mcp] VibeTide MCP server listening on http://127.0.0.1:3033/mcp
```

Stop the process with `Ctrl-C` after confirming startup.

- [ ] **Step 7: Commit documentation and verification updates**

```bash
git add README.md CLAUDE.md
git commit -m "docs: document mcp integration server"
```

---

## Task 9: Final Review and Cleanup

**Files:**
- Review: all files touched by Tasks 1-8

- [ ] **Step 1: Check git status**

Run:

```bash
git status --short
```

Expected: no unstaged or staged changes after the final commit.

- [ ] **Step 2: Review commit history**

Run:

```bash
git log --oneline -8
```

Expected: recent commits include the dependency, registry, auth, CMS adapter, audit, MCP server, bridge, and docs commits.

- [ ] **Step 3: Re-run focused tests**

Run:

```bash
npm test -- \
  src/lib/integrations/__tests__/registry.test.ts \
  src/lib/integrations/__tests__/audit.test.ts \
  src/lib/integrations/cms/__tests__/executor.test.ts \
  src/lib/mcp/__tests__/auth.test.ts \
  src/lib/mcp/__tests__/server.test.ts \
  src/lib/agent/tools/integration-bridge.test.ts
```

Expected: PASS.

- [ ] **Step 4: Capture final verification output**

Run:

```bash
npm run lint -- src/lib/integrations src/lib/mcp src/lib/agent/tools/integration-bridge.ts scripts/mcp-server.ts
```

Expected: PASS or documented unrelated lint warnings.

- [ ] **Step 5: Prepare handoff summary**

Summarize:

```md
Implemented:
- Generic integration adapter registry
- CMS adapter with four MVP tools
- Static API Key MCP auth
- Streamable HTTP MCP standalone server
- MCP invocation audit table and DAL
- Internal VibeTide agent bridge

Verified:
- Focused Vitest suite: PASS
- Focused lint: PASS
- MCP server startup: PASS

Notes:
- Live CMS calls were mocked in tests.
- Real CMS publish still requires existing CMS env and `VIBETIDE_CMS_PUBLISH_ENABLED=true`.
```

---

## Self-Review Checklist

Spec coverage:

- Generic adapter framework: Tasks 2 and 5.
- CMS MVP tools: Task 4.
- API Key auth: Task 3.
- MCP Streamable HTTP server: Task 6.
- Internal Agent bridge: Task 7.
- Audit records: Task 5.
- Tests and docs: Tasks 1, 8, and 9.

No raw CMS HTTP proxy appears in the plan. CMS publish and sync delegate to existing `@/lib/cms`. Live CMS connectivity is not required for CI tests.
