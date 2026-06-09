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

const articleRow = {
  id: "article_1",
  organizationId: "org_1",
  title: "Article 1",
  body: "body",
  summary: null,
  authorName: null,
  shortTitle: null,
  tags: [],
  coverImageUrl: null,
  publishedAt: null,
  publishStatus: "approved",
  externalUrl: null,
  galleryImages: null,
  videoId: null,
  audioId: null,
  mediaType: "article",
  missionId: null,
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

vi.mock("@/lib/dal/articles", () => ({
  getArticleById: vi.fn(async () => articleRow),
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
    const { getArticleById } = await import("@/lib/dal/articles");

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
    expect(getArticleById).toHaveBeenCalledWith("article_1");
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

  it("returns article_not_found before publish when article is missing", async () => {
    const { publishArticleToCms } = await import("@/lib/cms");
    const { getArticleById } = await import("@/lib/dal/articles");
    vi.mocked(getArticleById).mockResolvedValueOnce(null);

    const result = await cmsAdapter.execute(
      "cms.publish_article",
      { articleId: "missing_article" },
      context,
    );

    expect(result.ok).toBe(false);
    expect(result.error).toMatchObject({
      code: "article_not_found",
      stage: "read",
      retriable: false,
    });
    expect(publishArticleToCms).not.toHaveBeenCalled();
  });

  it("denies publish when article belongs to another organization", async () => {
    const { publishArticleToCms } = await import("@/lib/cms");
    const { getArticleById } = await import("@/lib/dal/articles");
    vi.mocked(getArticleById).mockResolvedValueOnce({
      ...articleRow,
      organizationId: "org_2",
    });

    const result = await cmsAdapter.execute(
      "cms.publish_article",
      { articleId: "article_1" },
      context,
    );

    expect(result.ok).toBe(false);
    expect(result.error).toMatchObject({
      code: "permission_denied",
      stage: "auth",
      retriable: false,
    });
    expect(publishArticleToCms).not.toHaveBeenCalled();
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
      triggerSource: "manual",
      operatorId: "agent-xiaofa",
      dryRun: true,
      deleteMissing: false,
    });
    expect(result.audit).toMatchObject({
      syncLogId: "sync_1",
      requestedSource: "mcp",
      triggerSource: "manual",
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

  it("truncates and sanitizes long publication status error messages", async () => {
    const { getPublicationById } = await import("@/lib/dal/cms-publications");
    vi.mocked(getPublicationById).mockResolvedValueOnce({
      ...publicationRow,
      cmsState: "failed",
      errorCode: "cms_business_error",
      errorMessage: `first line\nsecond line\t${"x".repeat(400)}`,
    });

    const result = await cmsAdapter.execute(
      "cms.get_publication_status",
      { publicationId: "pub_1" },
      context,
    );

    expect(result.ok).toBe(true);
    const data = result.data as { errorCode?: string; errorMessage?: string };
    expect(data.errorCode).toBe("cms_business_error");
    expect(data.errorMessage).toHaveLength(300);
    expect(data.errorMessage).toMatch(/^first line second line x+/);
    expect(data.errorMessage).toMatch(/\.\.\.$/);
    expect(data.errorMessage).not.toMatch(/[\u0000-\u001F\u007F]/);
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

  it("truncates and sanitizes long publication list error messages", async () => {
    const { listRecentPublicationsByOrg } = await import(
      "@/lib/dal/cms-publications"
    );
    vi.mocked(listRecentPublicationsByOrg).mockResolvedValueOnce([
      {
        ...publicationRow,
        cmsState: "failed",
        errorCode: "cms_business_error",
        errorMessage: `first line\r\nsecond line\u0007${"x".repeat(400)}`,
      },
    ]);

    const result = await cmsAdapter.execute(
      "cms.list_recent_publications",
      { limit: 1 },
      context,
    );

    expect(result.ok).toBe(true);
    const data = result.data as {
      publications?: Array<{ errorCode?: string; errorMessage?: string }>;
    };
    expect(data.publications?.[0]?.errorCode).toBe("cms_business_error");
    expect(data.publications?.[0]?.errorMessage).toHaveLength(300);
    expect(data.publications?.[0]?.errorMessage).toMatch(
      /^first line second line x+/,
    );
    expect(data.publications?.[0]?.errorMessage).toMatch(/\.\.\.$/);
    expect(data.publications?.[0]?.errorMessage).not.toMatch(
      /[\u0000-\u001F\u007F]/,
    );
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
