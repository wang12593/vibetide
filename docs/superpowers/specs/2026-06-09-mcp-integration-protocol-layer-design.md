# MCP Integration Protocol Layer Design

Date: 2026-06-09
Status: Approved for implementation planning
Scope: Generic third-party API adapter framework with CMS as the first MCP tool set

## 1. Background

VibeTide already has a production-oriented CMS integration layer in `src/lib/cms/`. That layer is the only CMS business gateway and already owns request mapping, schema validation, feature flags, idempotency, CMS publication records, retry dispatch, status polling, and Mission artifact notifications.

The new MCP protocol layer must expose third-party API capabilities to digital employees and external MCP hosts without bypassing those business protections. CMS is the first adapter, but the design must allow later adapters for WeChat, Feishu, WeCom, material systems, publishing platforms, or other partner APIs.

## 2. Goals

- Provide a standard MCP server over internal Streamable HTTP.
- Protect the MCP endpoint with API Key authentication in the first release.
- Build a generic integration adapter framework so third-party APIs are registered through a stable contract.
- Expose CMS MVP tools through MCP while reusing the existing `@/lib/cms` implementation.
- Bridge the same adapter tools back into VibeTide's internal Vercel AI SDK tool-calling path.
- Preserve multi-tenant boundaries, auditability, typed inputs, and structured errors.

## 3. Non-Goals

- Do not expose raw CMS HTTP proxy tools such as `cms.raw_post`.
- Do not reimplement CMS save, catalog sync, publication status polling, or retry logic in the MCP layer.
- Do not implement OAuth in the first release.
- Do not build a UI for API Key management in the first release.
- Do not support arbitrary OpenAPI-to-MCP generation in the first release.
- Do not add new third-party adapters beyond CMS in the first release.

## 4. Architecture

The first release uses six layers:

1. `src/lib/integrations/adapters/`
   - Generic third-party API adapter framework.
   - Defines adapter manifests, tool definitions, execution context, permission requirements, audit metadata, and result envelopes.

2. `src/lib/integrations/cms/`
   - CMS adapter package.
   - Only orchestrates adapter calls and delegates real work to `@/lib/cms` and CMS DAL modules.

3. `src/lib/mcp/registry/`
   - Converts integration adapter tools into MCP tools.
   - Owns MCP naming, schema conversion, permission checks, and error normalization.

4. `src/app/api/mcp/route.ts` or a dedicated `scripts/mcp-server.ts`
   - Streamable HTTP MCP server entry.
   - First implementation should prefer a Next.js route if the MCP SDK transport works cleanly with the app runtime. If framework streaming constraints block a correct MCP transport, the implementation should switch to a standalone Node server without changing adapter contracts.

5. `src/lib/mcp/auth.ts`
   - API Key parsing and authorization.
   - Produces a normalized `AdapterExecutionContext` for MCP requests.

6. `src/lib/agent/tools/integration-bridge.ts`
   - Converts the same integration adapter tools into Vercel AI SDK tools.
   - Allows VibeTide's internal digital employees to call the same capabilities without duplicating business logic.

The main architectural rule is that business capabilities are implemented once. Protocol concerns live in the MCP layer; CMS business behavior remains in `src/lib/cms/`.

## 5. Adapter Contract

Each adapter should be organized as:

- `manifest.ts`: platform metadata, tool metadata, permissions, destructive flags, audit flags.
- `tools.ts`: Zod input and output schemas plus tool descriptions.
- `executor.ts`: deterministic execution of registered tools.

The registry only depends on this interface:

```ts
export type AdapterActorType = "user" | "agent" | "api_key";
export type AdapterSource = "mcp" | "agent" | "server_action";

export interface AdapterExecutionContext {
  organizationId: string;
  actorId: string;
  actorType: AdapterActorType;
  requestId: string;
  source: AdapterSource;
  permissions: string[];
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
```

Manifest example:

```ts
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
  ],
} satisfies AdapterManifest;
```

## 6. CMS MVP Tools

The first release exposes four CMS tools. These tools are high-level business actions, not raw CMS endpoints.

### 6.1 `cms.publish_article`

Purpose: publish or submit an approved VibeTide article into CMS.

Input:

```ts
{
  articleId: string;
  allowUpdate?: boolean;
  triggerSource?: "workflow" | "manual" | "scheduled" | "daily_plan";
}
```

Behavior:

- Requires `cms:publish`.
- Calls `publishArticleToCms({ articleId, operatorId, triggerSource, allowUpdate })`.
- Uses `context.actorId` as `operatorId`.
- Defaults `triggerSource` to `workflow` for agent/MCP calls unless explicitly provided.
- Preserves existing feature flag, article status validation, idempotency, DTO mapping, `cms_publications` writes, retry dispatch, status polling, and Mission artifact notifications.

Output:

- Existing `PublishResult`, wrapped in the adapter result envelope.

### 6.2 `cms.sync_catalogs`

Purpose: sync CMS channels, applications, and catalog trees into VibeTide mapping tables.

Input:

```ts
{
  dryRun?: boolean;
  deleteMissing?: boolean;
}
```

Behavior:

- Requires `cms:sync`.
- Calls `syncCmsCatalogs(context.organizationId, { triggerSource: "mcp", operatorId, dryRun, deleteMissing })`.
- Defaults `deleteMissing` to `false` for MCP and internal agent calls unless the actor has an elevated permission such as `cms:sync:delete_missing`.

Output:

- Existing `SyncResult`, wrapped in the adapter result envelope.

### 6.3 `cms.get_publication_status`

Purpose: query one CMS publication record by `publicationId`.

Input:

```ts
{
  publicationId: string;
}
```

Behavior:

- Requires `cms:read`.
- Calls `getPublicationById(publicationId)`.
- Verifies the record belongs to `context.organizationId`.
- Returns a summary only, not full request payload or full article body.

Output summary:

```ts
{
  publicationId: string;
  articleId: string;
  cmsArticleId?: string;
  cmsCatalogId?: string;
  cmsSiteId?: number;
  cmsState: string;
  attempts: number;
  previewUrl?: string;
  publishedUrl?: string;
  errorCode?: string;
  errorMessage?: string;
  createdAt: string;
  updatedAt?: string;
}
```

### 6.4 `cms.list_recent_publications`

Purpose: list recent publication records for status tracking and review.

Input:

```ts
{
  state?: "submitting" | "submitted" | "synced" | "rejected_by_cms" | "failed" | "retrying";
  limit?: number;
}
```

Behavior:

- Requires `cms:read`.
- Reads records scoped to `context.organizationId`.
- Caps `limit` at 50.
- Returns summaries only.

## 7. Authentication and Authorization

The first release uses static API Keys from environment variables.

```bash
MCP_SERVER_ENABLED=true
MCP_API_KEYS='[
  {
    "key": "vt_mcp_xxx",
    "name": "internal-agent-host",
    "organizationId": "uuid",
    "actorId": "mcp-internal-agent-host",
    "permissions": ["cms:publish", "cms:sync", "cms:read"]
  }
]'
```

Rules:

- If `MCP_SERVER_ENABLED !== "true"`, MCP requests are rejected.
- Accept `Authorization: Bearer <key>`.
- Accept `x-api-key: <key>` for MCP hosts that cannot set bearer auth.
- Resolve the API Key into `AdapterExecutionContext`.
- Enforce tool permissions from the adapter manifest before execution.
- Keep authorization checks inside the adapter execution path so MCP and internal agent calls share the same guardrails.

Permission mapping:

- `cms.publish_article`: `cms:publish`
- `cms.sync_catalogs`: `cms:sync`
- `cms.get_publication_status`: `cms:read`
- `cms.list_recent_publications`: `cms:read`
- `cms.sync_catalogs` with `deleteMissing=true`: `cms:sync:delete_missing`

## 8. Auditing

The first implementation should reuse existing CMS business records and add one generic MCP/integration invocation audit record.

Preferred new table: `mcp_tool_invocations`.

Minimum fields:

- `id`
- `requestId`
- `adapterId`
- `toolName`
- `organizationId`
- `actorId`
- `actorType`
- `source`
- `inputSummary`
- `resultStatus`
- `errorCode`
- `durationMs`
- `createdAt`

Redaction rules:

- Do not store API Keys.
- Do not store CMS credentials.
- Do not store full article body HTML.
- Do not store full raw CMS request payload in generic MCP audit records.
- Store only identifiers, booleans, selected enum values, and bounded summaries.

Every tool result should include `requestId` so operators can correlate user-facing failures with server logs and audit records.

## 9. Error Model

All adapter and MCP tool failures should be normalized:

```ts
{
  ok: false,
  error: {
    code: "permission_denied",
    message: "API Key lacks cms:publish permission",
    retriable: false,
    stage: "auth"
  },
  requestId: "..."
}
```

Rules:

- Preserve CMS error classification where possible: `auth`, `network`, `cms_business`, `schema`, `config`, `polling`.
- Do not let model-facing tools imply success when the underlying deterministic function failed.
- Retriable CMS failures should still be surfaced as failures with `retriable=true`; background retry behavior remains owned by the CMS layer and queue.

## 10. Internal Agent Bridge

The internal bridge converts adapter tools into Vercel AI SDK `ToolSet` entries.

Proposed function:

```ts
createIntegrationAgentTools({
  adapters: [cmsAdapter],
  context: {
    organizationId,
    actorId: employeeId,
    actorType: "agent",
    source: "agent",
  },
  allowedPermissions,
});
```

Tool naming:

- MCP tool names keep dot notation:
  - `cms.publish_article`
  - `cms.sync_catalogs`
  - `cms.get_publication_status`
  - `cms.list_recent_publications`
- Internal Vercel AI SDK tools use underscore aliases:
  - `cms_publish_article`
  - `cms_sync_catalogs`
  - `cms_get_publication_status`
  - `cms_list_recent_publications`
- Audit records keep the original adapter tool name to avoid split histories.

Injection rules:

- Employees with `cms_publish` skill or equivalent `system_interop` authority can receive `cms_publish_article`.
- Employees with `cms_catalog_sync` skill or leader/admin authority can receive `cms_sync_catalogs`.
- Read tools can be exposed to channel operations, leader, and review employees.
- Even if a tool is injected, adapter permission checks still run at execution time.

Safety rules:

- Internal agent tools may not accept raw CMS DTOs.
- `cms_sync_catalogs` defaults `deleteMissing=false`.
- All returned errors are structured and visible to the model.

## 11. Testing Strategy

Adapter unit tests:

- `cms.publish_article` delegates to `publishArticleToCms`.
- `cms.sync_catalogs` delegates to `syncCmsCatalogs` and defaults `deleteMissing=false`.
- Query tools enforce `organizationId`.
- Permission failures return `permission_denied`.

MCP auth and protocol tests:

- MCP disabled returns a rejected response.
- Missing API Key returns `unauthorized`.
- Unknown API Key returns `unauthorized`.
- Known API Key with missing permission returns `permission_denied`.
- Known API Key can list tools and call read-only CMS tools.

Agent bridge tests:

- CMS skills or permissions cause the expected tools to be injected.
- Missing permissions prevent tool injection or fail execution.
- Internal tool aliases map to the original adapter tool names for audit.

Integration tests:

- Use MCP SDK client or route handler mocks to verify `tools/list` and `tools/call`.
- Mock `@/lib/cms` rather than real CMS APIs in CI.

## 12. Implementation Order

1. Add `src/lib/integrations` types, registry, permission checks, and result envelope.
2. Implement `cmsAdapter` and the four MVP CMS tools.
3. Implement `src/lib/mcp/auth.ts` and MCP registry conversion.
4. Add the Streamable HTTP MCP route or standalone server.
5. Add `src/lib/agent/tools/integration-bridge.ts`.
6. Connect the bridge to `src/lib/agent/tool-registry.ts`.
7. Add adapter, auth, protocol, and bridge tests.
8. Update documentation and environment examples.

## 13. Acceptance Criteria

- MCP clients can authenticate with API Key and list CMS tools.
- MCP clients can call `cms.get_publication_status`.
- MCP clients can call `cms.list_recent_publications`.
- `cms.publish_article` reuses `publishArticleToCms` and writes `cms_publications`.
- `cms.sync_catalogs` reuses `syncCmsCatalogs` and writes `cms_sync_logs`.
- Internal VibeTide digital employees can access the same CMS capabilities through the agent bridge when authorized.
- Multi-tenant checks prevent one API Key from reading or mutating another organization's records.
- Every tool failure returns a structured error and `requestId`.
- Tests do not require live CMS connectivity.

## 14. Open Implementation Decisions

- Whether the Streamable HTTP server runs as a Next.js route or standalone Node process should be decided during implementation after testing MCP SDK transport compatibility with the current Next.js runtime.
- Whether generic invocation audit writes to a new `mcp_tool_invocations` table or the existing audit system can be decided by inspecting the current audit schema during implementation.
- If a newer CMS API document is provided later, it should be used to validate `src/lib/cms` schemas and endpoint behavior before adding additional CMS tools.

## 15. References

- Existing CMS gateway: `src/lib/cms/index.ts`
- Existing CMS publish workflow: `src/lib/cms/publish/publish-article.ts`
- Existing CMS catalog sync skill: `skills/cms_catalog_sync/SKILL.md`
- Existing CMS publish skill: `skills/cms_publish/SKILL.md`
- Existing agent tool registry: `src/lib/agent/tool-registry.ts`
- MCP TypeScript SDK server documentation: https://ts.sdk.modelcontextprotocol.io/documents/server.html
- MCP transport concepts: https://modelcontextprotocol.io/docs/concepts/transports
