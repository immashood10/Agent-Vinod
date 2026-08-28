import { NextRequest, NextResponse } from "next/server";
import { rollbackTurn } from "@/lib/history-store";

export async function POST(req: NextRequest) {
  const { turnId } = await req.json();

  if (!turnId || typeof turnId !== "string") {
    return NextResponse.json(
      { error: "Missing turnId", success: false },
      { status: 400 }
    );
  }

  const result = await rollbackTurn(turnId);

  if (!result.success) {
    return NextResponse.json(
      { error: result.error, success: false },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
