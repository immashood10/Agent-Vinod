import { NextRequest, NextResponse } from "next/server";
import * as vfs from "@/lib/virtual-fs";

export async function GET(req: NextRequest) {
  const path = req.nextUrl.searchParams.get("path");

  if (!path) {
    return NextResponse.json(
      { error: "Missing path query parameter", success: false },
      { status: 400 }
    );
  }

  try {
    const content = vfs.readFile(path);
    return NextResponse.json({ content, success: true });
  } catch (error) {
    const err = error as Error;
    return NextResponse.json(
      { error: err.message, success: false },
      { status: 500 }
    );
  }
}
