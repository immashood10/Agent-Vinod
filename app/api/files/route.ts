import { NextResponse } from "next/server";
import * as vfs from "@/lib/virtual-fs";

export async function GET() {
  try {
    const files = vfs.listFilesTree("");
    return NextResponse.json({ files, success: true });
  } catch (error) {
    const err = error as Error;
    return NextResponse.json(
      { error: err.message, success: false },
      { status: 500 }
    );
  }
}
