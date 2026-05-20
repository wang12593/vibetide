"use server";

import { randomUUID } from "crypto";
import { requireAuth } from "@/lib/demo-auth";
import { getCurrentUserOrg } from "@/lib/dal/auth";
import { generateUploadUrl, generateDownloadUrl, defaultBucket } from "@/lib/volc-tos";

export async function getChatUploadUrl(fileName: string, contentType: string, fileSize: number) {
  const user = await requireAuth();
  const orgId = await getCurrentUserOrg();

  const ext = fileName.includes(".") ? fileName.split(".").pop() : "";
  const objectKey = `chat/${orgId}/${user.id}/${randomUUID()}/${fileName}`;

  const uploadUrl = generateUploadUrl(objectKey, contentType);
  const downloadUrl = generateDownloadUrl(objectKey);

  return {
    uploadUrl,
    downloadUrl,
    objectKey,
    bucket: defaultBucket,
    fileName,
    fileSize,
    contentType,
  };
}

export async function getChatDownloadUrl(objectKey: string) {
  await requireAuth();
  return generateDownloadUrl(objectKey);
}
