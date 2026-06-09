import type { IntegrationAdapter } from "@/lib/integrations/types";
import { executeCmsTool } from "./executor";
import { cmsAdapterManifest } from "./manifest";
import { cmsAdapterTools } from "./tools";

export const cmsAdapter: IntegrationAdapter = {
  manifest: cmsAdapterManifest,
  tools: cmsAdapterTools,
  execute: executeCmsTool,
};

export { executeCmsTool } from "./executor";
export { cmsAdapterManifest } from "./manifest";
export { cmsAdapterTools } from "./tools";
