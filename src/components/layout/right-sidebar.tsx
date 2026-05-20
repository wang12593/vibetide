"use client";

import { useState, useTransition } from "react";
import {
  Users,
  Wrench,
  BookMarked,
  Workflow,
  ChevronDown,
  Plus,
  ChevronLeft,
  Loader2,
  Globe,
  Database,
  Lightbulb,
  PenTool,
  Film,
  Shield,
  Brain,
  BarChart3,
  Share2,
  Package,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SkillFormDialog } from "@/components/shared/skill-form-dialog";
import { createKnowledgeBase } from "@/app/actions/knowledge-bases";
import { createCustomEmployee } from "@/app/actions/custom-employees";
import { EMPLOYEE_META } from "@/lib/constants";
import { useRouter } from "next/navigation";

type SkillCategory =
  | "web_search"
  | "data_collection"
  | "topic_planning"
  | "content_gen"
  | "av_script"
  | "quality_review"
  | "content_analysis"
  | "data_analysis"
  | "distribution"
  | "other";

const SKILL_CATEGORIES: { value: SkillCategory; label: string; icon: typeof Globe }[] = [
  { value: "web_search", label: "全网检索", icon: Globe },
  { value: "data_collection", label: "数据采集", icon: Database },
  { value: "topic_planning", label: "选题策划", icon: Lightbulb },
  { value: "content_gen", label: "内容生成", icon: PenTool },
  { value: "av_script", label: "视音频脚本", icon: Film },
  { value: "quality_review", label: "质量审核", icon: Shield },
  { value: "content_analysis", label: "内容分析", icon: Brain },
  { value: "data_analysis", label: "数据分析", icon: BarChart3 },
  { value: "distribution", label: "渠道分发", icon: Share2 },
  { value: "other", label: "其他", icon: Package },
];

const EMPLOYEE_TEMPLATES = Object.entries(EMPLOYEE_META).map(([id, meta]) => ({
  id,
  name: meta.name,
  title: meta.title,
}));

const SECTION_IDS = ["employees", "skills", "knowledge", "workflows"] as const;

export function RightSidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const [openSections, setOpenSections] = useState<Set<string>>(
    () => new Set(SECTION_IDS)
  );
  const router = useRouter();

  const toggleSection = (id: string) => {
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const sections = [
    { id: "employees", label: "AI 员工", icon: Users, content: <EmployeesSection /> },
    { id: "skills", label: "技能管理", icon: Wrench, content: <SkillsSection /> },
    { id: "knowledge", label: "知识库", icon: BookMarked, content: <KnowledgeSection /> },
    { id: "workflows", label: "工作流", icon: Workflow, content: <WorkflowsSection router={router} /> },
  ];

  return (
    <div className="relative flex h-full shrink-0">
      <div
        className={cn(
          "flex flex-col h-full bg-white dark:bg-[#1a1a1a] border-l border-border/40 transition-[width] duration-300 ease-out overflow-hidden",
          collapsed ? "w-0" : "w-[260px]"
        )}
      >
        <div className="flex items-center justify-between px-3 py-2.5 border-b border-border/40 shrink-0 min-w-[260px]">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            管理
          </span>
        </div>

        <div className="flex-1 overflow-y-auto sidebar-scroll min-w-[260px]">
          <div className="flex flex-col py-1">
            {sections.map((section) => {
              const Icon = section.icon;
              const isOpen = openSections.has(section.id);
              return (
                <div key={section.id} className="px-2">
                  <button
                    onClick={() => toggleSection(section.id)}
                    className="flex items-center gap-2 w-full px-2 py-2 rounded-lg text-[13px] font-medium text-foreground hover:bg-accent/50 transition-colors cursor-pointer border-0 bg-transparent"
                  >
                    <Icon size={15} strokeWidth={1.7} className="shrink-0 text-muted-foreground" />
                    <span className="flex-1 text-left truncate">{section.label}</span>
                    <ChevronDown
                      size={12}
                      className={cn(
                        "shrink-0 text-muted-foreground/50 transition-transform duration-200",
                        !isOpen && "-rotate-90"
                      )}
                    />
                  </button>
                  <div
                    className={cn(
                      "overflow-hidden transition-[max-height,opacity] duration-200 ease-out",
                      isOpen ? "max-h-[800px] opacity-100" : "max-h-0 opacity-0"
                    )}
                  >
                    <div className="pb-2 pl-1 pr-1">
                      {section.content}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <button
        onClick={() => setCollapsed(!collapsed)}
        className={cn(
          "absolute top-1/2 -translate-y-1/2 z-30",
          "w-5 h-10 rounded-l-lg flex items-center justify-center",
          "bg-white/90 dark:bg-[#1a1a1a]/90 backdrop-blur-sm",
          "border border-r-0 border-border/40",
          "hover:bg-accent transition-colors cursor-pointer"
        )}
        style={{
          right: collapsed ? "0" : "260px",
          transition: "right 300ms cubic-bezier(0.22, 0.68, 0.35, 1)",
        }}
        title={collapsed ? "展开面板" : "收起面板"}
      >
        <ChevronLeft
          size={12}
          className={cn(
            "text-muted-foreground transition-transform duration-300",
            collapsed && "rotate-180"
          )}
        />
      </button>
    </div>
  );
}

function EmployeesSection() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState(EMPLOYEE_TEMPLATES[0]?.id ?? "");
  const [instructions, setInstructions] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = () => {
    setError(null);
    if (!name.trim()) { setError("请输入名称"); return; }
    startTransition(async () => {
      try {
        await createCustomEmployee({
          name: name.trim(),
          description: description.trim(),
          baseTemplateSlug: selectedTemplate,
          instructions: instructions.trim(),
          skillIds: [],
          knowledgeBaseIds: [],
          visibility: "org",
        });
        setName("");
        setDescription("");
        setInstructions("");
        setOpen(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "创建失败");
      }
    });
  };

  return (
    <div className="space-y-1.5">
      <div className="space-y-1">
        {EMPLOYEE_TEMPLATES.slice(0, 6).map((t) => (
          <div
            key={t.id}
            className="flex items-center gap-2 px-2 py-1.5 rounded-md text-[12px] text-muted-foreground"
          >
            <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-medium text-primary shrink-0">
              {t.name.charAt(0)}
            </div>
            <span className="truncate flex-1">{t.name}</span>
            <span className="text-[10px] text-muted-foreground/60 shrink-0">{t.title}</span>
          </div>
        ))}
      </div>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 w-full rounded-md px-2 py-1.5 text-[12px] text-primary/70 hover:bg-accent hover:text-primary transition-colors cursor-pointer border-0 bg-transparent"
      >
        <Plus size={11} className="shrink-0" />
        <span>新建员工</span>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>新建数字员工</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>基础模板</Label>
              <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EMPLOYEE_TEMPLATES.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name} — {t.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>名称</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="输入员工名称" maxLength={50} />
            </div>
            <div className="space-y-2">
              <Label>一句话描述</Label>
              <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="例如：负责军事科技新闻撰写" maxLength={100} />
            </div>
            <div className="space-y-2">
              <Label>自定义指令</Label>
              <Textarea value={instructions} onChange={(e) => setInstructions(e.target.value)} placeholder="输入工作指令和行为规则…" rows={3} />
            </div>
            {error && <p className="text-sm text-red-500">{error}</p>}
            <Button onClick={handleSubmit} disabled={pending} className="w-full">
              {pending && <Loader2 size={14} className="mr-1.5 animate-spin" />}
              创建
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SkillsSection() {
  const [open, setOpen] = useState(false);

  return (
    <div className="space-y-1.5">
      <div className="space-y-0.5">
        {SKILL_CATEGORIES.slice(0, 8).map((cat) => {
          const CatIcon = cat.icon;
          return (
            <div key={cat.value} className="flex items-center gap-2 px-2 py-1.5 rounded-md text-[12px] text-muted-foreground">
              <CatIcon size={13} className="shrink-0 text-muted-foreground/60" />
              <span className="truncate flex-1">{cat.label}</span>
            </div>
          );
        })}
      </div>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 w-full rounded-md px-2 py-1.5 text-[12px] text-primary/70 hover:bg-accent hover:text-primary transition-colors cursor-pointer border-0 bg-transparent"
      >
        <Plus size={11} className="shrink-0" />
        <span>新建技能</span>
      </button>
      <SkillFormDialog open={open} onOpenChange={setOpen} />
    </div>
  );
}

function KnowledgeSection() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState("general");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const handleSubmit = () => {
    setError(null);
    if (!name.trim()) { setError("名称不能为空"); return; }
    startTransition(async () => {
      try {
        await createKnowledgeBase({ name, description, type });
        setName("");
        setDescription("");
        setType("general");
        setOpen(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "创建失败");
      }
    });
  };

  const kbTypes = [
    { value: "general", label: "通用" },
    { value: "channel_style", label: "频道风格" },
    { value: "sensitive_topics", label: "敏感话题" },
    { value: "domain_expert", label: "领域专业" },
  ];

  return (
    <div className="space-y-1.5">
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 w-full rounded-md px-2 py-1.5 text-[12px] text-primary/70 hover:bg-accent hover:text-primary transition-colors cursor-pointer border-0 bg-transparent"
      >
        <Plus size={11} className="shrink-0" />
        <span>新建知识库</span>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>新建知识库</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>名称</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="例如：企业品牌风格指南" maxLength={100} />
            </div>
            <div className="space-y-2">
              <Label>描述（可选）</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="简要说明内容与用途" rows={3} />
            </div>
            <div className="space-y-2">
              <Label>类型</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {kbTypes.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {error && <p className="text-sm text-red-500">{error}</p>}
            <Button onClick={handleSubmit} disabled={pending} className="w-full">
              {pending && <Loader2 size={14} className="mr-1.5 animate-spin" />}
              创建
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function WorkflowsSection({ router }: { router: ReturnType<typeof useRouter> }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [category, setCategory] = useState<string>("custom");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const categories = [
    { value: "news", label: "新闻报道" },
    { value: "video", label: "视频生产" },
    { value: "analytics", label: "数据分析" },
    { value: "distribution", label: "渠道运营" },
    { value: "custom", label: "自定义" },
  ];

  const handleSubmit = () => {
    setError(null);
    if (!name.trim()) { setError("名称不能为空"); return; }
    startTransition(async () => {
      try {
        const { saveWorkflow } = await import("@/app/actions/workflow-engine");
        const created = await saveWorkflow({
          name: name.trim(),
          description: description.trim() || undefined,
          category: category as "news" | "video" | "analytics" | "distribution" | "custom",
          triggerType: "manual",
          steps: [],
          inputFields: [],
          isEnabled: true,
        });
        setOpen(false);
        setName("");
        setDescription("");
        if (created?.id) {
          router.push(`/workflows/${created.id}/edit`);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "创建失败");
      }
    });
  };

  return (
    <div className="space-y-1.5">
      <div className="space-y-0.5">
        {categories.map((cat) => (
          <div key={cat.value} className="flex items-center gap-2 px-2 py-1.5 rounded-md text-[12px] text-muted-foreground">
            <span className="truncate flex-1">{cat.label}</span>
          </div>
        ))}
      </div>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 w-full rounded-md px-2 py-1.5 text-[12px] text-primary/70 hover:bg-accent hover:text-primary transition-colors cursor-pointer border-0 bg-transparent"
      >
        <Plus size={11} className="shrink-0" />
        <span>新建工作流</span>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>新建工作流</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>名称</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="输入工作流名称" />
            </div>
            <div className="space-y-2">
              <Label>分类</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>描述（可选）</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="描述工作流的用途" rows={3} />
            </div>
            {error && <p className="text-sm text-red-500">{error}</p>}
            <Button onClick={handleSubmit} disabled={pending} className="w-full">
              {pending && <Loader2 size={14} className="mr-1.5 animate-spin" />}
              创建并编辑
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
