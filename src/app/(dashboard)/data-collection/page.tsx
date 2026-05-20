/**
 * @hidden 数据采集 — 模块已解耦暂不开放，如需恢复请在侧边栏添加入口。
 * 如需修改请先确认不影响活跃模块后再操作。
 */

import { redirect } from "next/navigation";

export default function DataCollectionIndexPage() {
  redirect("/data-collection/sources");
}
