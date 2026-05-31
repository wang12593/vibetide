import { getWorkflowTemplate } from "@/lib/dal/workflow-templates";
import { listSkillsForWorkflowPicker } from "@/lib/dal/skills";
import { getEmployees } from "@/lib/dal/employees";
import { getAllToolParamSpecs } from "@/lib/agent/tool-registry";
import { WorkflowEditor } from "@/components/workflows/workflow-editor";
import { ErrorBoundary } from "@/components/workflows/error-boundary";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSuperAdmin } from "@/lib/rbac";

export const dynamic = "force-dynamic";

export default async function EditWorkflowPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const admin = user ? await isSuperAdmin(user.id) : false;

  const [workflow, skills, employees] = await Promise.all([
    getWorkflowTemplate(id),
    listSkillsForWorkflowPicker(user ? { userId: user.id, isAdmin: admin } : undefined).catch((err) => { console.error("[workflows/edit] load skills failed:", err); return []; }),
    getEmployees(user ? { userId: user.id, isAdmin: admin } : undefined).catch((err) => { console.error("[workflows/edit] load employees failed:", err); return []; }),
  ]);
  if (!workflow) return notFound();

  // 预计算所有工具的 zod inputSchema → JSON Schema → ToolParamSpec[]。
  // 必须在 server 侧做：tool-registry 拖着 db / drizzle 依赖，客户端 bundle 里
  // 不能 import。
  const toolParamSpecs = getAllToolParamSpecs();

  return (
    <div className="-m-6 h-[calc(100%+48px)] overflow-hidden">
      <ErrorBoundary>
        <WorkflowEditor
        mode="edit"
        skills={skills}
        employees={employees}
        toolParamSpecs={toolParamSpecs}
        initialData={{
          id: workflow.id,
          name: workflow.name,
          description: workflow.description || "",
          category: workflow.category || "custom",
          triggerType: workflow.triggerType || "manual",
          triggerConfig: workflow.triggerConfig,
          steps: workflow.steps,
          inputFields: workflow.inputFields ?? [],
          promptTemplate: workflow.promptTemplate ?? "",
          isEnabled: workflow.isEnabled,
          defaultTeam: workflow.defaultTeam ?? [],
        }}
      />
      </ErrorBoundary>
    </div>
  );
}
