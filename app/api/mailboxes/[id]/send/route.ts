import { NextResponse } from "next/server";
import { sendMailboxMessage } from "@/lib/mail";
import { getMailbox } from "@/lib/mailboxes";

export const runtime = "nodejs";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!process.env.MAIL_SEND_API_TOKEN || token !== process.env.MAIL_SEND_API_TOKEN) {
    return NextResponse.json({ error: "未授权发送邮件" }, { status: 401 });
  }

  const { id } = await context.params;
  const mailbox = getMailbox(id);
  if (!mailbox) return NextResponse.json({ error: "邮箱不存在" }, { status: 404 });

  const body = await request.json().catch(() => null) as { to?: string; subject?: string; text?: string; html?: string } | null;
  if (!body?.to || !body.subject || !body.text || !/^\S+@\S+\.\S+$/.test(body.to)) {
    return NextResponse.json({ error: "收件人、主题或正文无效" }, { status: 400 });
  }

  try {
    return NextResponse.json(await sendMailboxMessage(mailbox, {
      to: body.to,
      subject: body.subject,
      text: body.text,
      html: body.html,
    }));
  } catch (error) {
    const message = error instanceof Error ? error.message : "发送邮件失败";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

