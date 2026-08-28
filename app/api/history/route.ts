import { NextResponse } from "next/server";
import { getHistory } from "@/lib/history-store";

export async function GET() {
  const history = getHistory();
  return NextResponse.json({ ...history, success: true });
}
