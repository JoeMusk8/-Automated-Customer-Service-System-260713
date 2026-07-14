import { NextResponse } from "next/server";
import { listRecentMessages } from "@/lib/mail";
import { getMailbox } from "@/lib/mailboxes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!process.env.MAIL_READ_API_TOKEN || token !== process.env.MAIL_READ_API_TOKEN) {
    return NextResponse.json({ error: "未授权读取邮件" }, { status: 401 });
  }

  const { id } = await context.params;
  const mailbox = getMailbox(id);
  if (!mailbox) return NextResponse.json({ error: "邮箱不存在" }, { status: 404 });

  const requestedLimit = Number(new URL(request.url).searchParams.get("limit") || 30);
  const limit = Number.isFinite(requestedLimit) ? Math.max(1, Math.min(requestedLimit, 100)) : 30;

  try {
    return NextResponse.json({ mailbox: mailbox.address, messages: await listRecentMessages(mailbox, limit) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "读取邮件失败";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
