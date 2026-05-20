import { db } from "@/db";
import { missions, missionTasks } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getCurrentUserAndOrg } from "@/lib/dal/auth";

function extractFinalContent(
  mission: { finalOutput: unknown; title: string },
  tasks: Array<{ title: string; status: string; outputData: unknown }>
): string | null {
  const finalOutput = mission.finalOutput as Record<string, unknown> | null;

  if (finalOutput?.artifacts && Array.isArray(finalOutput.artifacts)) {
    for (const art of finalOutput.artifacts as Array<{ content?: string }>) {
      if (art.content) return art.content;
    }
  }

  if (typeof mission.finalOutput === "string" && mission.finalOutput.length > 100) {
    return mission.finalOutput;
  }

  if (finalOutput?.text && typeof finalOutput.text === "string" && (finalOutput.text as string).length > 50) {
    return finalOutput.text as string;
  }

  const parts: string[] = [];
  for (const task of tasks) {
    if (task.status !== "completed") continue;
    const taskOutput = task.outputData as Record<string, unknown> | null;
    if (taskOutput?.artifacts && Array.isArray(taskOutput.artifacts)) {
      for (const art of taskOutput.artifacts as Array<{ content?: string; title?: string }>) {
        if (art.content) {
          parts.push(`## ${task.title}\n\n${art.content}`);
        }
      }
    }
    if (taskOutput?.text && typeof taskOutput.text === "string" && (taskOutput.text as string).length > 50) {
      parts.push(`## ${task.title}\n\n${taskOutput.text}`);
    }
  }

  return parts.length > 0 ? parts.join("\n\n---\n\n") : null;
}

function markdownToHtmlDocx(md: string, title: string): Buffer {
  const html = `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:w="urn:schemas-microsoft-com:office:word"
      xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta charset="utf-8">
<title>${escapeHtml(title)}</title>
<style>
  body { font-family: "Microsoft YaHei", "SimSun", Arial, sans-serif; font-size: 12pt; line-height: 1.8; color: #333; max-width: 680px; margin: 0 auto; padding: 20px; }
  h1 { font-size: 20pt; font-weight: bold; color: #1a1a1a; margin: 24px 0 12px; border-bottom: 2px solid #e5e5e5; padding-bottom: 8px; }
  h2 { font-size: 16pt; font-weight: bold; color: #333; margin: 20px 0 10px; }
  h3 { font-size: 14pt; font-weight: bold; color: #444; margin: 16px 0 8px; }
  p { margin: 8px 0; }
  ul, ol { margin: 8px 0; padding-left: 24px; }
  li { margin: 4px 0; }
  strong { font-weight: bold; }
  blockquote { border-left: 4px solid #ddd; margin: 12px 0; padding: 8px 16px; color: #666; background: #f9f9f9; }
  code { font-family: "Courier New", monospace; font-size: 10pt; background: #f5f5f5; padding: 2px 4px; border-radius: 3px; }
  pre { background: #f5f5f5; padding: 12px; border-radius: 4px; overflow-x: auto; }
  pre code { background: none; padding: 0; }
  hr { border: none; border-top: 1px solid #e5e5e5; margin: 20px 0; }
  table { border-collapse: collapse; width: 100%; margin: 12px 0; }
  th, td { border: 1px solid #ddd; padding: 8px 12px; text-align: left; }
  th { background: #f5f5f5; font-weight: bold; }
</style>
</head>
<body>
${mdToHtml(md, title)}
</body>
</html>`;

  return Buffer.from(html, "utf-8");
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function mdToHtml(md: string, title: string): string {
  let html = `<h1>${escapeHtml(title)}</h1>\n`;
  const lines = md.split("\n");
  let inList = false;
  let listTag = "";

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();

    if (line.startsWith("### ")) {
      if (inList) { html += `</${listTag}>\n`; inList = false; }
      html += `<h3>${escapeHtml(line.slice(4))}</h3>\n`;
    } else if (line.startsWith("## ")) {
      if (inList) { html += `</${listTag}>\n`; inList = false; }
      html += `<h2>${escapeHtml(line.slice(3))}</h2>\n`;
    } else if (line.startsWith("# ")) {
      if (inList) { html += `</${listTag}>\n`; inList = false; }
      html += `<h1>${escapeHtml(line.slice(2))}</h1>\n`;
    } else if (line.startsWith("---")) {
      if (inList) { html += `</${listTag}>\n`; inList = false; }
      html += `<hr>\n`;
    } else if (line.startsWith("- ") || line.startsWith("* ")) {
      if (!inList || listTag !== "ul") {
        if (inList) html += `</${listTag}>\n`;
        html += `<ul>\n`;
        inList = true;
        listTag = "ul";
      }
      html += `<li>${inlineFormat(line.slice(2))}</li>\n`;
    } else if (/^\d+\.\s/.test(line)) {
      if (!inList || listTag !== "ol") {
        if (inList) html += `</${listTag}>\n`;
        html += `<ol>\n`;
        inList = true;
        listTag = "ol";
      }
      html += `<li>${inlineFormat(line.replace(/^\d+\.\s/, ""))}</li>\n`;
    } else if (line === "") {
      if (inList) { html += `</${listTag}>\n`; inList = false; }
    } else {
      if (inList) { html += `</${listTag}>\n`; inList = false; }
      html += `<p>${inlineFormat(line)}</p>\n`;
    }
  }
  if (inList) html += `</${listTag}>\n`;

  return html;
}

function inlineFormat(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`(.+?)`/g, "<code>$1</code>");
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await getCurrentUserAndOrg();
  if (!authResult) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { id } = await params;

  const mission = await db.query.missions.findFirst({
    where: eq(missions.id, id),
  });

  if (!mission) {
    return new Response("Mission not found", { status: 404 });
  }

  if (mission.organizationId !== authResult.organizationId) {
    return new Response("Forbidden", { status: 403 });
  }

  const tasks = await db
    .select({
      id: missionTasks.id,
      title: missionTasks.title,
      status: missionTasks.status,
      outputData: missionTasks.outputData,
    })
    .from(missionTasks)
    .where(eq(missionTasks.missionId, id));

  const content = extractFinalContent(
    { finalOutput: mission.finalOutput, title: mission.title },
    tasks
  );

  if (!content) {
    return new Response("No artifacts found", { status: 404 });
  }

  const url = new URL(req.url);
  const format = url.searchParams.get("format") || "md";
  const safeTitle = (mission.title || "artifact").replace(/[^\w\u4e00-\u9fff\-]/g, "_");

  if (format === "docx") {
    const docxBuffer = markdownToHtmlDocx(content, mission.title);
    return new Response(new Uint8Array(docxBuffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${encodeURIComponent(safeTitle)}.doc"`,
      },
    });
  }

  return new Response(content, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="${encodeURIComponent(safeTitle)}.md"`,
    },
  });
}
