import { NextRequest, NextResponse } from "next/server";
import * as vfs from "@/lib/virtual-fs";

const MIME_TYPES: Record<string, string> = {
  html: "text/html; charset=utf-8",
  css: "text/css; charset=utf-8",
  js: "text/javascript; charset=utf-8",
  json: "application/json; charset=utf-8",
  svg: "image/svg+xml",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  ico: "image/x-icon",
  webp: "image/webp",
  txt: "text/plain; charset=utf-8",
};

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  const filePath = path.join("/") || "index.html";

  if (!vfs.fileExists(filePath)) {
    return new NextResponse(`Not found: ${filePath}`, { status: 404 });
  }

  const content = vfs.readFile(filePath);
  const extension = filePath.split(".").pop()?.toLowerCase() || "";
  const contentType = MIME_TYPES[extension] || "text/plain; charset=utf-8";

  return new NextResponse(content, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "no-store",
    },
  });
}
