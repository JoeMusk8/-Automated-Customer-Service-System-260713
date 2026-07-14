import { NextResponse } from "next/server";
import { testMailbox } from "@/lib/mail";
import { getMailbox } from "@/lib/mailboxes";

export const runtime = "nodejs";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const mailbox = getMailbox(id);
  if (!mailbox) return NextResponse.json({ error: "邮箱不存在" }, { status: 404 });

  try {
    const result = await testMailbox(mailbox);
    return NextResponse.json({ mailbox: mailbox.address, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "邮箱连接失败";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

