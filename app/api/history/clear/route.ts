import { NextResponse } from "next/server";
import { clearHistory } from "@/lib/history-store";

export async function POST() {
  clearHistory();
  return NextResponse.json({ success: true });
}
