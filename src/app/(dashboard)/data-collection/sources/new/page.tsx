/**
 * @hidden 数据采集 — 模块已解耦暂不开放，如需恢复请在侧边栏添加入口。
 * 如需修改请先确认不影响活跃模块后再操作。
 */

import { listAdapterMetas } from "@/lib/collection/adapter-meta";
import { NewSourceWizardClient } from "./new-source-wizard-client";

export const dynamic = "force-dynamic";

export default function NewSourcePage() {
  const adapterMetas = listAdapterMetas();
  return <NewSourceWizardClient adapterMetas={adapterMetas} />;
}
