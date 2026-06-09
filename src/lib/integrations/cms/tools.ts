import { z } from "zod";
import type { AdapterToolDefinition } from "@/lib/integrations/types";

export const cmsPublicationStateSchema = z.enum([
  "submitting",
  "submitted",
  "synced",
  "rejected_by_cms",
  "failed",
  "retrying",
]);

export const cmsPublishArticleInputSchema = z.object({
  articleId: z.string().min(1),
  allowUpdate: z.boolean().optional(),
  triggerSource: z
    .enum(["workflow", "manual", "scheduled", "daily_plan"])
    .optional(),
});

export const cmsSyncCatalogsInputSchema = z.object({
  dryRun: z.boolean().optional(),
  deleteMissing: z.boolean().optional(),
});

export const cmsGetPublicationStatusInputSchema = z.object({
  publicationId: z.string().min(1),
});

export const cmsListRecentPublicationsInputSchema = z.object({
  state: cmsPublicationStateSchema.optional(),
  limit: z.number().int().min(1).max(50).optional(),
});

export type CmsPublicationStateInput = z.infer<typeof cmsPublicationStateSchema>;
export type CmsPublishArticleInput = z.infer<
  typeof cmsPublishArticleInputSchema
>;
export type CmsSyncCatalogsInput = z.infer<typeof cmsSyncCatalogsInputSchema>;
export type CmsGetPublicationStatusInput = z.infer<
  typeof cmsGetPublicationStatusInputSchema
>;
export type CmsListRecentPublicationsInput = z.infer<
  typeof cmsListRecentPublicationsInputSchema
>;

export const cmsAdapterTools: AdapterToolDefinition[] = [
  {
    name: "cms.publish_article",
    title: "Publish Article to CMS",
    description: "Publish an approved VibeTide article into CMS",
    inputSchema: cmsPublishArticleInputSchema,
  },
  {
    name: "cms.sync_catalogs",
    title: "Sync CMS Catalogs",
    description: "Sync CMS channels, applications, and catalogs into VibeTide",
    inputSchema: cmsSyncCatalogsInputSchema,
  },
  {
    name: "cms.get_publication_status",
    title: "Get CMS Publication Status",
    description: "Read one CMS publication record by publication ID",
    inputSchema: cmsGetPublicationStatusInputSchema,
  },
  {
    name: "cms.list_recent_publications",
    title: "List Recent CMS Publications",
    description: "List recent CMS publication records for the current organization",
    inputSchema: cmsListRecentPublicationsInputSchema,
  },
];
