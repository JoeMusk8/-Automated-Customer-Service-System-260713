import { NextResponse } from "next/server";
import { listRecentMessages } from "@/lib/mail";
import { getMailbox } from "@/lib/mailboxes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const mailboxIds = ["xjoy", "kissly"] as const;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const requested = url.searchParams.get("mailbox") || "all";
  const requestedLimit = Number(url.searchParams.get("limit") || 20);
  const limit = Number.isFinite(requestedLimit) ? Math.max(1, Math.min(requestedLimit, 50)) : 20;
  const ids = requested === "all"
    ? mailboxIds
    : mailboxIds.filter((id) => id === requested);

  if (!ids.length) {
    return NextResponse.json({ error: "邮箱不存在" }, { status: 404 });
  }

  const results = await Promise.all(ids.map(async (id) => {
    const mailbox = getMailbox(id)!;
    try {
      const messages = await listRecentMessages(mailbox, limit);
      return {
        id,
        projectId: mailbox.projectId,
        address: mailbox.address,
        connected: true,
        messages,
      };
    } catch (error) {
      return {
        id,
        projectId: mailbox.projectId,
        address: mailbox.address,
        connected: false,
        error: error instanceof Error ? error.message : "读取邮件失败",
        messages: [],
      };
    }
  }));

  return NextResponse.json(
    { mailboxes: results, refreshedAt: new Date().toISOString() },
    { headers: { "Cache-Control": "private, no-store, max-age=0" } },
  );
}
