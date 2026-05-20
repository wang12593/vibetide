import { WorkflowEditor } from "@/components/workflows/workflow-editor";
import { listSkillsForWorkflowPicker } from "@/lib/dal/skills";
import { getEmployees } from "@/lib/dal/employees";
import { getAllToolParamSpecs } from "@/lib/agent/tool-registry";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function NewWorkflowPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const [skills, employees] = await Promise.all([
    listSkillsForWorkflowPicker().catch((err) => { console.error("[workflows/new] load skills failed:", err); return []; }),
    getEmployees(user ? { userId: user.id } : undefined).catch((err) => { console.error("[workflows/new] load employees failed:", err); return []; }),
  ]);
  // 预计算工具参数 spec 透传给 WorkflowEditor —— 客户端不能直接 import
  // tool-registry（server-only 依赖）。
  const toolParamSpecs = getAllToolParamSpecs();

  return (
    <div className="-m-6 h-[calc(100%+48px)] overflow-hidden">
      <WorkflowEditor
        mode="create"
        skills={skills}
        employees={employees}
        toolParamSpecs={toolParamSpecs}
      />
    </div>
  );
}
