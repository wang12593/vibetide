import { publishArticleToCms, syncCmsCatalogs } from "@/lib/cms";
import { getArticleById } from "@/lib/dal/articles";
import {
  type CmsPublicationState,
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

type PublicationSummaryRow = {
  id: string;
  organizationId: string;
  articleId: string;
  cmsArticleId?: string | null;
  cmsCatalogId?: string | null;
  cmsSiteId?: number | null;
  cmsState: CmsPublicationState;
  attempts?: number | null;
  previewUrl?: string | null;
  publishedUrl?: string | null;
  errorCode?: string | null;
  errorMessage?: string | null;
  createdAt?: Date | string | null;
  updatedAt?: Date | string | null;
};

function serializeDate(value: Date | string | null | undefined) {
  if (!value) return undefined;
  return value instanceof Date ? value.toISOString() : value;
}

function summarizeErrorMessage(value: string | null | undefined) {
  if (!value) return undefined;

  const sanitized = value.replace(/[\u0000-\u001F\u007F]+/g, " ");
  return sanitized.length > 300 ? `${sanitized.slice(0, 297)}...` : sanitized;
}

function includeDefined<T extends Record<string, unknown>>(value: T) {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined),
  );
}

function summarizePublication(row: PublicationSummaryRow) {
  return includeDefined({
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
    errorMessage: summarizeErrorMessage(row.errorMessage),
    createdAt: serializeDate(row.createdAt),
    updatedAt: serializeDate(row.updatedAt),
  });
}

export async function executeCmsTool(
  toolName: string,
  input: unknown,
  context: AdapterExecutionContext,
): Promise<AdapterToolResult> {
  switch (toolName) {
    case "cms.publish_article": {
      const typed = input as CmsPublishArticleInput;
      const article = await getArticleById(typed.articleId);

      if (!article) {
        return adapterFailure(
          "article_not_found",
          `Article not found: ${typed.articleId}`,
          { articleId: typed.articleId },
          "read",
          false,
        );
      }

      if (article.organizationId !== context.organizationId) {
        return adapterFailure(
          "permission_denied",
          "Article belongs to another organization",
          { articleId: typed.articleId },
          "auth",
          false,
        );
      }

      const triggerSource = typed.triggerSource ?? "workflow";
      const data = await publishArticleToCms({
        articleId: typed.articleId,
        operatorId: context.actorId,
        triggerSource,
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
          triggerSource,
          allowUpdate: typed.allowUpdate,
        },
      };
    }

    case "cms.sync_catalogs": {
      const typed = input as CmsSyncCatalogsInput;
      const dryRun = typed.dryRun === true;
      const deleteMissing = typed.deleteMissing === true;

      if (
        deleteMissing &&
        !context.permissions.includes("cms:sync:delete_missing")
      ) {
        return adapterFailure(
          "permission_denied",
          "Missing required permission: cms:sync:delete_missing",
          { permission: "cms:sync:delete_missing", deleteMissing },
          "auth",
          false,
        );
      }

      const data = await syncCmsCatalogs(context.organizationId, {
        triggerSource: "manual",
        operatorId: context.actorId,
        dryRun,
        deleteMissing,
      });

      return {
        ok: true,
        data,
        audit: {
          syncLogId: data.syncLogId,
          requestedSource: "mcp",
          triggerSource: "manual",
          dryRun,
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
          { publicationId: typed.publicationId },
          "read",
          false,
        );
      }

      if (row.organizationId !== context.organizationId) {
        return adapterFailure(
          "permission_denied",
          "Publication belongs to another organization",
          { publicationId: typed.publicationId },
          "auth",
          false,
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
      const limit = typed.limit ?? 20;
      const rows = await listRecentPublicationsByOrg(context.organizationId, {
        state: typed.state,
        limit,
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
          limit,
          count: publications.length,
        },
      };
    }

    default:
      return adapterFailure(
        "tool_not_found",
        `CMS tool not found: ${toolName}`,
        { toolName },
        "registry",
        false,
      );
  }
}
