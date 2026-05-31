import { registerKnowledgeBaseWorkers } from "./knowledge-base";
import { registerCmsWorkers } from "./cms";
import { registerCollectionWorkers } from "./collection";
import { registerResearchWorkers } from "./research";
import { registerScheduledWorkers } from "./scheduled";
import { registerPublishingWorkers } from "./publishing";

export function registerAllWorkers() {
  registerKnowledgeBaseWorkers();
  registerCmsWorkers();
  registerCollectionWorkers();
  registerResearchWorkers();
  registerScheduledWorkers();
  registerPublishingWorkers();

  console.debug("[BullMQ] All workers registered (6 queues, 23+ handlers)");
}
