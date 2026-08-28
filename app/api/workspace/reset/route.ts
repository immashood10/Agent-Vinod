import { NextResponse } from "next/server";
import * as vfs from "@/lib/virtual-fs";

export async function POST() {
  vfs.reset();
  return NextResponse.json({ success: true });
}
