import "server-only";

const KISSLY_API_ORIGIN = "https://www.share-email.com";

type KisslyResponse<T> = {
  code: number;
  msg?: string;
  data?: T;
  total?: number;
  count?: number;
};

type KisslyContact = { email?: string; xm?: string };

type KisslyListMessage = {
  uid?: string | number;
  subject?: string;
  from?: string;
  from_lxr?: KisslyContact[];
  f_date?: string;
  timestamp?: string | number;
  is_read?: string | number | boolean;
  is_attachment?: string | number | boolean;
};

type KisslyMessageDetail = KisslyListMessage & {
  body?: {
    html?: string;
    file?: Array<{ name?: string; filename?: string; type?: string; size?: number }>;
  };
};

function token() {
  const value = process.env.MAIL_KISSLY_API_TOKEN?.trim();
  if (!value) throw new Error("KISSLY 网页邮箱令牌尚未配置");
  return value;
}

async function post<T>(path: string, values: Record<string, string> = {}) {
  const response = await fetch(`${KISSLY_API_ORIGIN}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
      token: token(),
    },
    body: new URLSearchParams(values),
    cache: "no-store",
  });

  if (!response.ok) throw new Error(`KISSLY API 请求失败（HTTP ${response.status}）`);
  const result = (await response.json()) as KisslyResponse<T>;
  if (result.code !== 1) {
    if (result.code === -1000) throw new Error("KISSLY 网页邮箱令牌已过期，请重新登录后更新令牌");
    throw new Error(result.msg || `KISSLY API 返回错误 ${result.code}`);
  }
  return result;
}

function firstAddress(message: KisslyListMessage) {
  return message.from_lxr?.find((contact) => contact.email)?.email || message.from || "";
}

function isoDate(message: KisslyListMessage) {
  if (message.timestamp != null && message.timestamp !== "") {
    const timestamp = Number(message.timestamp);
    if (Number.isFinite(timestamp)) {
      return new Date(timestamp < 1e12 ? timestamp * 1000 : timestamp).toISOString();
    }
  }
  const parsed = message.f_date ? new Date(message.f_date) : new Date();
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
}

function isUnread(value: KisslyListMessage["is_read"]) {
  return !(value === 1 || value === "1" || value === true);
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;")
    .replaceAll("\n", "<br>");
}

export function isKisslyApiConfigured() {
  return Boolean(process.env.MAIL_KISSLY_API_TOKEN?.trim());
}

export async function testKisslyApi() {
  await post<KisslyListMessage[]>("/user_msg/list_mail", {
    fld: "INBOX",
    page: "1",
    search: "",
    gj_search: "",
  });
  return { imap: true, smtp: true, transport: "kissly-web-api" as const };
}

export async function listKisslyMessages(limit = 30) {
  const result = await post<KisslyListMessage[]>("/user_msg/list_mail", {
    fld: "INBOX",
    page: "1",
    search: "",
    gj_search: "",
  });
  const listed = Array.isArray(result.data) ? result.data.slice(0, Math.min(limit, 100)) : [];

  const messages = await Promise.all(listed.filter((message) => message.uid != null).map(async (listedMessage) => {
    let detail: KisslyMessageDetail = listedMessage;
    try {
      const detailResult = await post<KisslyMessageDetail>("/user_msg/show_mail", {
        uid: String(listedMessage.uid),
        fld: "INBOX",
      });
      if (detailResult.data) detail = detailResult.data;
    } catch {
      // A list result is still useful if one message body cannot be loaded.
    }

    const html = detail.body?.html || "";
    return {
      uid: Number(listedMessage.uid) || String(listedMessage.uid),
      mailboxId: "kissly" as const,
      projectId: "kissly" as const,
      from: firstAddress(detail),
      subject: detail.subject || "(无主题)",
      date: isoDate(detail),
      text: html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim(),
      html,
      unread: isUnread(detail.is_read),
      attachments: (detail.body?.file || []).map((file) => ({
        filename: file.filename || file.name || "attachment",
        contentType: file.type || "application/octet-stream",
        size: file.size || 0,
      })),
    };
  }));
  return messages;
}

export async function sendKisslyMessage(input: { to: string; subject: string; text: string; html?: string }) {
  const recipient = JSON.stringify([{ email: input.to, xm: input.to }]);
  const result = await post<{ uid?: string | number; message_id?: string }>("/user_msg/send", {
    to: recipient,
    subject: input.subject,
    html: input.html || escapeHtml(input.text),
    file: "[]",
  });
  return {
    messageId: result.data?.message_id || String(result.data?.uid || "kissly-sent"),
    accepted: [input.to],
    rejected: [],
  };
}
