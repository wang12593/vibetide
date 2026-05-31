"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  toggleWorkflowEnabled,
  deleteWorkflow,
  saveWorkflow,
} from "@/app/actions/workflow-engine";
import {
  createEmployee,
  deleteEmployee,
  toggleEmployeeDisabled,
} from "@/app/actions/employees";
import {
  createKnowledgeBase,
  deleteKnowledgeBase,
} from "@/app/actions/knowledge-bases";

interface WorkflowItem {
  id: string;
  name: string;
  description: string | null;
  isEnabled: boolean;
  isBuiltin: boolean;
}

interface EmployeeItem {
  id: string;
  dbId: string;
  name: string;
  nickname: string;
  slug: string;
  role: string;
  isPreset: boolean;
  disabled: boolean;
}

interface KBItem {
  id: string;
  name: string;
  description: string | null;
  documentCount: number;
}

type Tab = "workflows" | "employees" | "knowledge";

export function MulanConfigClient({
  initialWorkflows,
  initialEmployees,
  initialKnowledgeBases,
}: {
  initialWorkflows: WorkflowItem[];
  initialEmployees: EmployeeItem[];
  initialKnowledgeBases: KBItem[];
}) {
  const [tab, setTab] = useState<Tab>("workflows");
  const [workflows, setWorkflows] = useState(initialWorkflows);
  const [employees, setEmployees] = useState(initialEmployees);
  const [knowledgeBases, setKnowledgeBases] = useState(initialKnowledgeBases);
  const [saving, setSaving] = useState(false);
  const [showAdd, setShowAdd] = useState<string | false>(false);

  const [newWF, setNewWF] = useState({ name: "", description: "" });
  const [newEmp, setNewEmp] = useState({ name: "", nickname: "", slug: "", title: "", roleType: "executor" });
  const [newKB, setNewKB] = useState({ name: "", description: "" });

  const handleToggleWF = async (id: string, enabled: boolean) => {
    setSaving(true);
    try { await toggleWorkflowEnabled(id, !enabled); } catch (err) { console.error(err); }
    setWorkflows((prev) => prev.map((w) => w.id === id ? { ...w, isEnabled: !enabled } : w));
    setSaving(false);
  };

  const handleDeleteWF = async (id: string) => {
    if (!confirm("确认删除此场景？")) return;
    setSaving(true);
    try { await deleteWorkflow(id); } catch (err) { console.error(err); }
    setWorkflows((prev) => prev.filter((w) => w.id !== id));
    setSaving(false);
  };

  const handleAddWF = async () => {
    if (!newWF.name.trim()) return;
    setSaving(true);
    try {
      await saveWorkflow({
        name: newWF.name,
        description: newWF.description,
        category: "custom",
        steps: [{
          id: "step-1",
          order: 1,
          dependsOn: [],
          name: newWF.name,
          type: "skill",
          config: { skillSlug: "web_search", skillName: "网络搜索", skillCategory: "web_search", parameters: {} },
        }],
        inputFields: [],
        defaultTeam: ["xiaolei"],
      });
      setWorkflows((prev) => [...prev, {
        id: Date.now().toString(),
        name: newWF.name,
        description: newWF.description || null,
        isEnabled: true,
        isBuiltin: false,
      }]);
      setShowAdd(false);
      setNewWF({ name: "", description: "" });
    } catch (err) { console.error(err); }
    setSaving(false);
  };

  const handleToggleEmp = async (dbId: string, disabled: boolean) => {
    setSaving(true);
    try { await toggleEmployeeDisabled(dbId, !disabled); } catch (err) { console.error(err); }
    setEmployees((prev) => prev.map((e) => e.dbId === dbId ? { ...e, disabled: !disabled } : e));
    setSaving(false);
  };

  const handleDeleteEmp = async (dbId: string) => {
    if (!confirm("确认删除此员工？")) return;
    setSaving(true);
    try { await deleteEmployee(dbId); } catch (err) { console.error(err); }
    setEmployees((prev) => prev.filter((e) => e.dbId !== dbId));
    setSaving(false);
  };

  const handleAddEmp = async () => {
    if (!newEmp.name.trim() || !newEmp.slug.trim()) return;
    setSaving(true);
    try {
      await createEmployee({
        name: newEmp.name,
        nickname: newEmp.nickname || newEmp.name,
        slug: newEmp.slug,
        title: newEmp.title || newEmp.name,
        roleType: newEmp.roleType,
      });
      setEmployees((prev) => [...prev, {
        id: Date.now().toString(),
        dbId: Date.now().toString(),
        name: newEmp.name,
        nickname: newEmp.nickname || newEmp.name,
        slug: newEmp.slug,
        role: newEmp.title || newEmp.name,
        isPreset: false,
        disabled: false,
      }]);
      setShowAdd(false);
      setNewEmp({ name: "", nickname: "", slug: "", title: "", roleType: "executor" });
    } catch (err) { console.error(err); }
    setSaving(false);
  };

  const handleDeleteKB = async (id: string) => {
    if (!confirm("确认删除此知识库？")) return;
    setSaving(true);
    try { await deleteKnowledgeBase(id); } catch (err) { console.error(err); }
    setKnowledgeBases((prev) => prev.filter((k) => k.id !== id));
    setSaving(false);
  };

  const handleAddKB = async () => {
    if (!newKB.name.trim()) return;
    setSaving(true);
    try {
      await createKnowledgeBase({ name: newKB.name, description: newKB.description });
      setKnowledgeBases((prev) => [...prev, {
        id: Date.now().toString(),
        name: newKB.name,
        description: newKB.description || null,
        documentCount: 0,
      }]);
      setShowAdd(false);
      setNewKB({ name: "", description: "" });
    } catch (err) { console.error(err); }
    setSaving(false);
  };

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: "workflows", label: "场景/场景", count: workflows.length },
    { key: "employees", label: "员工", count: employees.length },
    { key: "knowledge", label: "知识库", count: knowledgeBases.length },
  ];

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">穆兰配置</h1>
        <p className="text-sm text-muted-foreground mt-1">管理场景、员工和知识库</p>
      </div>

      <div className="flex gap-1 border-b border-slate-200 dark:border-slate-700">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => { setTab(t.key); setShowAdd(false); }}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === t.key
                ? "border-blue-500 text-blue-600"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label} ({t.count})
          </button>
        ))}
      </div>

      {tab === "workflows" && (
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-base">场景 / 场景</CardTitle>
            <button onClick={() => setShowAdd(showAdd === "wf" ? false : "wf")}
              className="px-3 py-1 rounded-md text-xs font-medium bg-blue-600 text-white hover:bg-blue-700">
              {showAdd === "wf" ? "取消" : "+ 新建"}
            </button>
          </CardHeader>
          <CardContent>
            {showAdd === "wf" && (
              <div className="mb-4 p-3 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20 space-y-2">
                <input value={newWF.name} onChange={(e) => setNewWF((p) => ({ ...p, name: e.target.value }))} placeholder="场景名称" className="w-full px-3 py-1.5 rounded-md border text-sm" />
                <input value={newWF.description} onChange={(e) => setNewWF((p) => ({ ...p, description: e.target.value }))} placeholder="描述（可选）" className="w-full px-3 py-1.5 rounded-md border text-sm" />
                <button onClick={handleAddWF} disabled={saving || !newWF.name.trim()} className="px-3 py-1 rounded-md text-xs font-medium bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50">
                  {saving ? "创建中..." : "确认创建"}
                </button>
              </div>
            )}
            {workflows.length === 0 ? (
              <div className="text-sm text-muted-foreground py-4 text-center">暂无场景</div>
            ) : (
              <div className="space-y-1">
                {workflows.map((wf) => (
                  <div key={wf.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 group">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{wf.name}</div>
                      {wf.description && <div className="text-xs text-muted-foreground truncate">{wf.description}</div>}
                    </div>
                    <div className="flex items-center gap-2 ml-3">
                      {wf.isBuiltin && <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">内置</span>}
                      <button onClick={() => handleToggleWF(wf.id, wf.isEnabled)} disabled={saving}
                        className={`relative w-9 h-5 rounded-full transition-colors flex-shrink-0 ${wf.isEnabled ? "bg-blue-500" : "bg-slate-300 dark:bg-slate-600"}`}>
                        <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${wf.isEnabled ? "left-[18px]" : "left-0.5"}`} />
                      </button>
                      <button onClick={() => handleDeleteWF(wf.id)} disabled={saving}
                        className="text-xs text-red-500 hover:text-red-700 opacity-0 group-hover:opacity-100 transition-opacity">
                        删除
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {tab === "employees" && (
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-base">员工管理</CardTitle>
            <button onClick={() => setShowAdd(showAdd === "emp" ? false : "emp")}
              className="px-3 py-1 rounded-md text-xs font-medium bg-blue-600 text-white hover:bg-blue-700">
              {showAdd === "emp" ? "取消" : "+ 新建"}
            </button>
          </CardHeader>
          <CardContent>
            {showAdd === "emp" && (
              <div className="mb-4 p-3 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20 space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <input value={newEmp.name} onChange={(e) => setNewEmp((p) => ({ ...p, name: e.target.value }))} placeholder="角色名（如：热点猎手）" className="px-3 py-1.5 rounded-md border text-sm" />
                  <input value={newEmp.nickname} onChange={(e) => setNewEmp((p) => ({ ...p, nickname: e.target.value }))} placeholder="显示名（如：小雷）" className="px-3 py-1.5 rounded-md border text-sm" />
                  <input value={newEmp.slug} onChange={(e) => setNewEmp((p) => ({ ...p, slug: e.target.value }))} placeholder="唯一标识（如：xiaolei）" className="px-3 py-1.5 rounded-md border text-sm" />
                  <input value={newEmp.title} onChange={(e) => setNewEmp((p) => ({ ...p, title: e.target.value }))} placeholder="头衔（如：资深分析师）" className="px-3 py-1.5 rounded-md border text-sm" />
                </div>
                <button onClick={handleAddEmp} disabled={saving || !newEmp.name.trim() || !newEmp.slug.trim()} className="px-3 py-1 rounded-md text-xs font-medium bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50">
                  {saving ? "创建中..." : "确认创建"}
                </button>
              </div>
            )}
            {employees.length === 0 ? (
              <div className="text-sm text-muted-foreground py-4 text-center">暂无员工</div>
            ) : (
              <div className="space-y-1">
                {employees.map((emp) => (
                  <div key={emp.dbId} className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 group">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium">{emp.nickname || emp.name} <span className="text-muted-foreground text-xs">({emp.slug})</span></div>
                      {emp.role && <div className="text-xs text-muted-foreground">{emp.role}</div>}
                    </div>
                    <div className="flex items-center gap-2 ml-3">
                      {emp.isPreset && <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">内置</span>}
                      <button onClick={() => handleToggleEmp(emp.dbId, emp.disabled)} disabled={saving}
                        className={`relative w-9 h-5 rounded-full transition-colors flex-shrink-0 ${!emp.disabled ? "bg-blue-500" : "bg-slate-300 dark:bg-slate-600"}`}>
                        <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${!emp.disabled ? "left-[18px]" : "left-0.5"}`} />
                      </button>
                      {!emp.isPreset && (
                        <button onClick={() => handleDeleteEmp(emp.dbId)} disabled={saving}
                          className="text-xs text-red-500 hover:text-red-700 opacity-0 group-hover:opacity-100 transition-opacity">
                          删除
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {tab === "knowledge" && (
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-base">知识库管理</CardTitle>
            <button onClick={() => setShowAdd(showAdd === "kb" ? false : "kb")}
              className="px-3 py-1 rounded-md text-xs font-medium bg-blue-600 text-white hover:bg-blue-700">
              {showAdd === "kb" ? "取消" : "+ 新建"}
            </button>
          </CardHeader>
          <CardContent>
            {showAdd === "kb" && (
              <div className="mb-4 p-3 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20 space-y-2">
                <input value={newKB.name} onChange={(e) => setNewKB((p) => ({ ...p, name: e.target.value }))} placeholder="知识库名称" className="w-full px-3 py-1.5 rounded-md border text-sm" />
                <input value={newKB.description} onChange={(e) => setNewKB((p) => ({ ...p, description: e.target.value }))} placeholder="描述（可选）" className="w-full px-3 py-1.5 rounded-md border text-sm" />
                <button onClick={handleAddKB} disabled={saving || !newKB.name.trim()} className="px-3 py-1 rounded-md text-xs font-medium bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50">
                  {saving ? "创建中..." : "确认创建"}
                </button>
              </div>
            )}
            {knowledgeBases.length === 0 ? (
              <div className="text-sm text-muted-foreground py-4 text-center">暂无知识库</div>
            ) : (
              <div className="space-y-1">
                {knowledgeBases.map((kb) => (
                  <div key={kb.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 group">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium">{kb.name}</div>
                      <div className="text-xs text-muted-foreground">{kb.documentCount} 篇文档</div>
                    </div>
                    <button onClick={() => handleDeleteKB(kb.id)} disabled={saving}
                      className="text-xs text-red-500 hover:text-red-700 opacity-0 group-hover:opacity-100 transition-opacity ml-3">
                      删除
                    </button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
