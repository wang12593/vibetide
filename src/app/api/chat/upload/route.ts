import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { randomUUID } from "crypto";
import { requireAuth } from "@/lib/demo-auth";
import { getCurrentUserOrg } from "@/lib/dal/auth";

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const orgId = await getCurrentUserOrg();

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (file.size > 50 * 1024 * 1024) {
      return NextResponse.json({ error: "File too large (max 50MB)" }, { status: 400 });
    }

    const ext = file.name.includes(".") ? `.${file.name.split(".").pop()}` : "";
    const storedName = `${randomUUID()}${ext}`;
    const relativeDir = `uploads/chat/${orgId}/${user.id}`;
    const absoluteDir = join(process.cwd(), "public", relativeDir);

    await mkdir(absoluteDir, { recursive: true });

    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(join(absoluteDir, storedName), buffer);

    const downloadUrl = `/${relativeDir}/${storedName}`;

    return NextResponse.json({
      downloadUrl,
      fileName: file.name,
      fileSize: file.size,
      contentType: file.type || "application/octet-stream",
    });
  } catch (err) {
    console.error("[chat/upload] Error:", err);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
