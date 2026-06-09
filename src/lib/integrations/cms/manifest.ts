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
