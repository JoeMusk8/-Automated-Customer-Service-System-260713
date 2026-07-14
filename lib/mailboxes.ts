import "server-only";

export type MailboxId = "xjoy" | "kissly";

export type MailboxConfig = {
  id: MailboxId;
  projectId: "x-pink" | "kissly";
  address: string;
  imap: { host: string; port: number; secure: boolean };
  smtp: { host: string; port: number; secure: boolean };
  auth: { user: string; pass: string };
};

function bool(value: string | undefined, fallback: boolean) {
  if (value == null) return fallback;
  return value.toLowerCase() === "true";
}

function port(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

const definitions = {
  xjoy: {
    projectId: "x-pink" as const,
    address: "business@xjoy.ai",
    prefix: "XJOY",
    imapHost: "us3.imap.mailhostbox.com",
    smtpHost: "us3.smtp.mailhostbox.com",
  },
  kissly: {
    projectId: "kissly" as const,
    address: "business@kissly.ai",
    prefix: "KISSLY",
    imapHost: "mail.emb666.com",
    smtpHost: "mail.emb666.com",
  },
};

export function getMailbox(id: string): MailboxConfig | null {
  if (id !== "xjoy" && id !== "kissly") return null;
  const definition = definitions[id];
  const prefix = definition.prefix;
  const user = process.env[`MAIL_${prefix}_USER`] || definition.address;

  return {
    id,
    projectId: definition.projectId,
    address: definition.address,
    imap: {
      host: process.env[`MAIL_${prefix}_IMAP_HOST`] || definition.imapHost,
      port: port(process.env[`MAIL_${prefix}_IMAP_PORT`], 993),
      secure: bool(process.env[`MAIL_${prefix}_IMAP_SECURE`], true),
    },
    smtp: {
      host: process.env[`MAIL_${prefix}_SMTP_HOST`] || definition.smtpHost,
      port: port(process.env[`MAIL_${prefix}_SMTP_PORT`], 587),
      secure: bool(process.env[`MAIL_${prefix}_SMTP_SECURE`], false),
    },
    auth: {
      user,
      pass: process.env[`MAIL_${prefix}_PASSWORD`] || "",
    },
  };
}

export function getMailboxStatus() {
  return (["xjoy", "kissly"] as const).map((id) => {
    const mailbox = getMailbox(id)!;
    return {
      id,
      projectId: mailbox.projectId,
      address: mailbox.address,
      configured: Boolean(mailbox.auth.user && mailbox.auth.pass),
      imapHost: mailbox.imap.host,
      smtpHost: mailbox.smtp.host,
    };
  });
}
