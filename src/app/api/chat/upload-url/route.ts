import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { generateUploadUrl, generateDownloadUrl, defaultBucket } from "@/lib/volc-tos";
import { requireAuth } from "@/lib/demo-auth";
import { getCurrentUserOrg } from "@/lib/dal/auth";

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const orgId = await getCurrentUserOrg();

    const body = await request.json();
    const { fileName, contentType, fileSize } = body;

    if (!fileName || !contentType || !fileSize) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    if (fileSize > 50 * 1024 * 1024) {
      return NextResponse.json({ error: "File too large (max 50MB)" }, { status: 400 });
    }

    const objectKey = `chat/${orgId}/${user.id}/${randomUUID()}/${fileName}`;
    const uploadUrl = generateUploadUrl(objectKey, contentType);
    const downloadUrl = generateDownloadUrl(objectKey);

    return NextResponse.json({
      uploadUrl,
      downloadUrl,
      objectKey,
      bucket: defaultBucket,
    });
  } catch (err) {
    console.error("[chat/upload-url] Error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
