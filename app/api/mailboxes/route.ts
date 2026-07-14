import { NextResponse } from "next/server";
import { getMailboxStatus } from "@/lib/mailboxes";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({ mailboxes: getMailboxStatus() });
}

