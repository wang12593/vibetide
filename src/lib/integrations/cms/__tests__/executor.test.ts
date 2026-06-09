import { beforeEach, describe, expect, it, vi } from "vitest";
import { cmsAdapter } from "../index";
import type { AdapterExecutionContext } from "@/lib/integrations/types";

const publicationRow = {
  id: "pub_1",
  organizationId: "org_1",
  articleId: "article_1",
  cmsArticleId: "1001",
  cmsCatalogId: "10210",
  cmsSiteId: 81,
  cmsState: "submitted" as const,
  attempts: 1,
  previewUrl: "https://preview",
  publishedUrl: "https://published",
  errorCode: null,
  errorMessage: null,
  cmsType: 1,
  requestHash: "hash_1",
  requestPayload: { raw: "hidden" },
  responsePayload: { raw: "hidden" },
  operatorId: "agent-xiaofa",
  triggerSource: "workflow",
  scheduledAt: null,
  submittedAt: new Date("2026-06-09T00:01:00Z"),
  syncedAt: null,
  lastAttemptAt: new Date("2026-06-09T00:00:30Z"),
  createdAt: new Date("2026-06-09T00:00:00Z"),
  updatedAt: new Date("2026-06-09T00:01:00Z"),
};

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
  getPublicationById: vi.fn(async () => publicationRow),
  listRecentPublicationsByOrg: vi.fn(async () => [publicationRow]),
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

  it("declares the CMS manifest and exactly four tools", () => {
    expect(cmsAdapter.manifest).toMatchObject({
      id: "cms",
      displayName: "Huaqiyun CMS",
      version: "1.0.0",
      authMode: "env",
    });
    expect(cmsAdapter.tools.map((tool) => tool.name)).toEqual([
      "cms.publish_article",
      "cms.sync_catalogs",
      "cms.get_publication_status",
      "cms.list_recent_publications",
    ]);
    expect(cmsAdapter.manifest.tools.map((tool) => tool.permissions)).toEqual([
      ["cms:publish"],
      ["cms:sync"],
      ["cms:read"],
      ["cms:read"],
    ]);
  });

  it("publishes articles through the existing CMS workflow", async () => {
    const { publishArticleToCms } = await import("@/lib/cms");

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
    expect(publishArticleToCms).toHaveBeenCalledWith({
      articleId: "article_1",
      operatorId: "agent-xiaofa",
      triggerSource: "workflow",
      allowUpdate: false,
    });
    expect(result.audit).toMatchObject({
      articleId: "article_1",
      publicationId: "pub_1",
      cmsArticleId: "1001",
      cmsState: "submitted",
      triggerSource: "workflow",
      allowUpdate: false,
    });
  });

  it("syncs catalogs with deleteMissing defaulting false", async () => {
    const { syncCmsCatalogs } = await import("@/lib/cms");

    const result = await cmsAdapter.execute(
      "cms.sync_catalogs",
      { dryRun: true },
      context,
    );

    expect(result.ok).toBe(true);
    expect(syncCmsCatalogs).toHaveBeenCalledWith("org_1", {
      triggerSource: "mcp",
      operatorId: "agent-xiaofa",
      dryRun: true,
      deleteMissing: false,
    });
    expect(result.audit).toMatchObject({
      syncLogId: "sync_1",
      dryRun: true,
      deleteMissing: false,
    });
  });

  it("rejects deleteMissing without elevated permission", async () => {
    const { syncCmsCatalogs } = await import("@/lib/cms");

    const result = await cmsAdapter.execute(
      "cms.sync_catalogs",
      { deleteMissing: true },
      context,
    );

    expect(result.ok).toBe(false);
    expect(result.error).toMatchObject({
      code: "permission_denied",
      stage: "auth",
      retriable: false,
    });
    expect(syncCmsCatalogs).not.toHaveBeenCalled();
  });

  it("syncs deleteMissing when elevated permission is present", async () => {
    const result = await cmsAdapter.execute(
      "cms.sync_catalogs",
      { deleteMissing: true },
      {
        ...context,
        permissions: [...context.permissions, "cms:sync:delete_missing"],
      },
    );

    expect(result.ok).toBe(true);
    expect(result.audit).toMatchObject({ deleteMissing: true });
  });

  it("returns a bounded publication status scoped to organization", async () => {
    const { getPublicationById } = await import("@/lib/dal/cms-publications");

    const result = await cmsAdapter.execute(
      "cms.get_publication_status",
      { publicationId: "pub_1" },
      context,
    );

    expect(result.ok).toBe(true);
    expect(getPublicationById).toHaveBeenCalledWith("pub_1");
    expect(result.data).toEqual({
      publicationId: "pub_1",
      articleId: "article_1",
      cmsArticleId: "1001",
      cmsCatalogId: "10210",
      cmsSiteId: 81,
      cmsState: "submitted",
      attempts: 1,
      previewUrl: "https://preview",
      publishedUrl: "https://published",
      createdAt: "2026-06-09T00:00:00.000Z",
      updatedAt: "2026-06-09T00:01:00.000Z",
    });
  });

  it("denies publication status across organization boundaries", async () => {
    const { getPublicationById } = await import("@/lib/dal/cms-publications");
    vi.mocked(getPublicationById).mockResolvedValueOnce({
      ...publicationRow,
      organizationId: "org_2",
    });

    const result = await cmsAdapter.execute(
      "cms.get_publication_status",
      { publicationId: "pub_1" },
      context,
    );

    expect(result.ok).toBe(false);
    expect(result.error).toMatchObject({
      code: "permission_denied",
      stage: "auth",
      retriable: false,
    });
  });

  it("returns publication_not_found when status row is missing", async () => {
    const { getPublicationById } = await import("@/lib/dal/cms-publications");
    vi.mocked(getPublicationById).mockResolvedValueOnce(null);

    const result = await cmsAdapter.execute(
      "cms.get_publication_status",
      { publicationId: "missing" },
      context,
    );

    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe("publication_not_found");
  });

  it("lists recent publications through the organization-scoped DAL helper", async () => {
    const { listRecentPublicationsByOrg } = await import(
      "@/lib/dal/cms-publications"
    );

    const result = await cmsAdapter.execute(
      "cms.list_recent_publications",
      { state: "submitted", limit: 50 },
      context,
    );

    expect(result.ok).toBe(true);
    expect(listRecentPublicationsByOrg).toHaveBeenCalledWith("org_1", {
      state: "submitted",
      limit: 50,
    });
    expect(result.data).toEqual({
      count: 1,
      publications: [
        {
          publicationId: "pub_1",
          articleId: "article_1",
          cmsArticleId: "1001",
          cmsCatalogId: "10210",
          cmsSiteId: 81,
          cmsState: "submitted",
          attempts: 1,
          previewUrl: "https://preview",
          publishedUrl: "https://published",
          createdAt: "2026-06-09T00:00:00.000Z",
          updatedAt: "2026-06-09T00:01:00.000Z",
        },
      ],
    });
  });

  it("returns tool_not_found for unknown CMS tools", async () => {
    const result = await cmsAdapter.execute("cms.unknown", {}, context);

    expect(result.ok).toBe(false);
    expect(result.error).toMatchObject({
      code: "tool_not_found",
      stage: "registry",
      retriable: false,
    });
  });
});
