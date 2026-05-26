import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { randomUUID } from "crypto";
import { db } from "@/db";
import { knowledgeBases, kbDocuments, knowledgeItems } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { requireAuth } from "@/lib/demo-auth";
import { getCurrentUserOrg } from "@/lib/dal/auth";
import { detectFileType, parseFile } from "@/lib/knowledge/file-parser";
import type { SupportedFileType } from "@/lib/knowledge/file-parser";
import { chunkText, buildSnippet } from "@/lib/knowledge/chunking";

const MAX_FILE_SIZE = 50 * 1024 * 1024;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const orgId = await getCurrentUserOrg();
    const { id: kbId } = await params;

    const kb = await db.query.knowledgeBases.findFirst({
      where: eq(knowledgeBases.id, kbId),
      columns: { id: true, organizationId: true },
    });
    if (!kb || kb.organizationId !== orgId) {
      return NextResponse.json({ error: "知识库不存在或无权访问" }, { status: 404 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ error: "未提供文件" }, { status: 400 });
    }
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "文件过大（最大 50MB）" }, { status: 400 });
    }

    const fileType = detectFileType(file.type, file.name);
    if (!fileType) {
      return NextResponse.json(
        { error: "不支持的文件类型，仅支持 PDF、Word、TXT、Markdown" },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    const docId = randomUUID();
    const ext = file.name.includes(".") ? `.${file.name.split(".").pop()}` : "";
    const storedName = `${docId}${ext}`;
    const relativeDir = `uploads/kb/${orgId}/${kbId}`;
    const absoluteDir = join(process.cwd(), "public", relativeDir);
    await mkdir(absoluteDir, { recursive: true });
    await writeFile(join(absoluteDir, storedName), buffer);
    const storagePath = `/${relativeDir}/${storedName}`;

    await db.insert(kbDocuments).values({
      id: docId,
      knowledgeBaseId: kbId,
      fileName: file.name,
      fileType,
      fileSize: file.size,
      storagePath,
      parseStatus: "parsing",
      uploadedBy: user.id,
    });

    let text: string;
    try {
      text = await parseFile(buffer, fileType as SupportedFileType);
    } catch (parseErr) {
      await db
        .update(kbDocuments)
        .set({
          parseStatus: "failed",
          errorMessage: parseErr instanceof Error ? parseErr.message : "解析失败",
          updatedAt: new Date(),
        })
        .where(eq(kbDocuments.id, docId));
      return NextResponse.json({ error: "文件解析失败" }, { status: 422 });
    }

    if (!text || text.trim().length < 10) {
      await db
        .update(kbDocuments)
        .set({
          parseStatus: "failed",
          errorMessage: "文件内容为空或过短",
          updatedAt: new Date(),
        })
        .where(eq(kbDocuments.id, docId));
      return NextResponse.json({ error: "文件内容为空或过短" }, { status: 422 });
    }

    const chunks = chunkText(text.trim());
    const maxIdxRow = await db
      .select({ max: sql<number>`COALESCE(MAX(${knowledgeItems.chunkIndex}), -1)::int` })
      .from(knowledgeItems)
      .where(eq(knowledgeItems.knowledgeBaseId, kbId));
    const startIndex = Number(maxIdxRow[0]?.max ?? -1) + 1;

    const titleBase = file.name.replace(/\.[^.]+$/, "");
    const rows = chunks.map((chunk, idx) => ({
      knowledgeBaseId: kbId,
      title: chunks.length > 1 ? `${titleBase} #${idx + 1}` : titleBase,
      snippet: buildSnippet(chunk),
      fullContent: chunk,
      sourceDocument: file.name,
      sourceType: "upload" as const,
      chunkIndex: startIndex + idx,
      tags: [],
    }));

    await db.insert(knowledgeItems).values(rows);

    await db
      .update(kbDocuments)
      .set({
        parseStatus: "done",
        chunkCount: chunks.length,
        updatedAt: new Date(),
      })
      .where(eq(kbDocuments.id, docId));

    await db
      .update(knowledgeBases)
      .set({
        documentCount: sql`${knowledgeBases.documentCount} + 1`,
        chunkCount: sql`${knowledgeBases.chunkCount} + ${chunks.length}`,
        vectorizationStatus: "pending",
        updatedAt: new Date(),
      })
      .where(eq(knowledgeBases.id, kbId));

    return NextResponse.json({
      id: docId,
      fileName: file.name,
      fileType,
      fileSize: file.size,
      parseStatus: "done",
      chunkCount: chunks.length,
    });
  } catch (err) {
    console.error("[kb/upload] Error:", err);
    return NextResponse.json({ error: "上传失败" }, { status: 500 });
  }
}
