import * as pdfParse from "pdf-parse";
import mammoth from "mammoth";

export type SupportedFileType = "pdf" | "docx" | "txt" | "md";

const MIME_MAP: Record<string, SupportedFileType> = {
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "text/plain": "txt",
  "text/markdown": "md",
};

const EXT_MAP: Record<string, SupportedFileType> = {
  pdf: "pdf",
  docx: "docx",
  txt: "txt",
  md: "md",
};

export function detectFileType(
  mimeType: string | null,
  fileName: string
): SupportedFileType | null {
  if (mimeType && MIME_MAP[mimeType]) return MIME_MAP[mimeType];
  const ext = fileName.split(".").pop()?.toLowerCase() || "";
  return EXT_MAP[ext] || null;
}

export async function parseFile(
  buffer: Buffer,
  fileType: SupportedFileType
): Promise<string> {
  switch (fileType) {
    case "pdf":
      return parsePdf(buffer);
    case "docx":
      return parseDocx(buffer);
    case "txt":
    case "md":
      return buffer.toString("utf-8");
    default:
      throw new Error(`不支持的文件类型: ${fileType}`);
  }
}

async function parsePdf(buffer: Buffer): Promise<string> {
  const data = await (pdfParse as unknown as (buf: Buffer) => Promise<{ text: string }>)(
    buffer
  );
  return data.text.trim();
}

async function parseDocx(buffer: Buffer): Promise<string> {
  const result = await mammoth.extractRawText({ buffer });
  return result.value.trim();
}
