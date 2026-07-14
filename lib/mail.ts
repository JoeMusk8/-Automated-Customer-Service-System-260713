import "server-only";

import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import nodemailer from "nodemailer";
import type { MailboxConfig } from "./mailboxes";
import {
  isKisslyApiConfigured,
  listKisslyMessages,
  sendKisslyMessage,
  testKisslyApi,
} from "./kissly-api";
import {
  isXjoyRoundcubeConfigured,
  listXjoyMessages,
  sendXjoyMessage,
  testXjoyRoundcube,
} from "./xjoy-roundcube";

function assertConfigured(mailbox: MailboxConfig) {
  if (!mailbox.auth.user || !mailbox.auth.pass) {
    throw new Error(`${mailbox.address} 尚未配置邮箱密码或应用专用密码`);
  }
}

function imapClient(mailbox: MailboxConfig) {
  const client = new ImapFlow({
    host: mailbox.imap.host,
    port: mailbox.imap.port,
    secure: mailbox.imap.secure,
    auth: mailbox.auth,
    logger: false,
  });
  client.on("error", () => undefined);
  return client;
}

function smtpClient(mailbox: MailboxConfig) {
  return nodemailer.createTransport({
    host: mailbox.smtp.host,
    port: mailbox.smtp.port,
    secure: mailbox.smtp.secure,
    auth: mailbox.auth,
  });
}

export async function testMailbox(mailbox: MailboxConfig) {
  if (mailbox.id === "kissly" && isKisslyApiConfigured()) return testKisslyApi();
  if (mailbox.id === "xjoy" && isXjoyRoundcubeConfigured()) return testXjoyRoundcube();
  assertConfigured(mailbox);
  const imap = imapClient(mailbox);
  let imapConnected = false;

  try {
    await imap.connect();
    imapConnected = true;
  } finally {
    if (imapConnected) await imap.logout().catch(() => undefined);
  }

  await smtpClient(mailbox).verify();
  return { imap: true, smtp: true };
}

export async function listRecentMessages(mailbox: MailboxConfig, limit = 30) {
  if (mailbox.id === "kissly" && isKisslyApiConfigured()) return listKisslyMessages(limit);
  if (mailbox.id === "xjoy" && isXjoyRoundcubeConfigured()) return listXjoyMessages(limit);
  assertConfigured(mailbox);
  const imap = imapClient(mailbox);
  await imap.connect();

  try {
    const lock = await imap.getMailboxLock("INBOX");
    try {
      const total = imap.mailbox && imap.mailbox.exists ? imap.mailbox.exists : 0;
      if (!total) return [];
      const start = Math.max(1, total - Math.min(limit, 100) + 1);
      const messages = [];

      for await (const item of imap.fetch(`${start}:*`, { uid: true, envelope: true, flags: true, source: true })) {
        if (!item.source) continue;
        const parsed = await simpleParser(item.source);
        messages.push({
          uid: item.uid,
          mailboxId: mailbox.id,
          projectId: mailbox.projectId,
          from: parsed.from?.value?.[0]?.address || item.envelope?.from?.[0]?.address || "",
          subject: parsed.subject || item.envelope?.subject || "(无主题)",
          date: (parsed.date || item.envelope?.date || new Date()).toISOString(),
          text: parsed.text || "",
          html: typeof parsed.html === "string" ? parsed.html : "",
          unread: !item.flags?.has("\\Seen"),
          attachments: parsed.attachments.map((attachment) => ({
            filename: attachment.filename || "attachment",
            contentType: attachment.contentType,
            size: attachment.size,
          })),
        });
      }

      return messages.reverse();
    } finally {
      lock.release();
    }
  } finally {
    await imap.logout().catch(() => undefined);
  }
}

export async function sendMailboxMessage(mailbox: MailboxConfig, input: { to: string; subject: string; text: string; html?: string }) {
  if (mailbox.id === "kissly" && isKisslyApiConfigured()) return sendKisslyMessage(input);
  if (mailbox.id === "xjoy" && isXjoyRoundcubeConfigured()) return sendXjoyMessage(input);
  assertConfigured(mailbox);
  const result = await smtpClient(mailbox).sendMail({
    from: mailbox.address,
    replyTo: mailbox.address,
    to: input.to,
    subject: input.subject,
    text: input.text,
    html: input.html,
  });
  return { messageId: result.messageId, accepted: result.accepted, rejected: result.rejected };
}
