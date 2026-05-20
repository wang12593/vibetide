import { requirePermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/rbac-constants";
import { ContentManagementClient } from "./content-client";

export const dynamic = "force-dynamic";

export default async function ContentManagementPage() {
  await requirePermission(PERMISSIONS.CONTENT_VIEW_ALL);

  return <ContentManagementClient />;
}
