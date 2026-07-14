import "server-only";

import https from "node:https";
import { simpleParser } from "mailparser";

const DEFAULT_TLS_HOST = "us3.webmail.mailhostbox.com";
const DEFAULT_TENANT_HOST = "webmail.xjoy.ai";

type RoundcubeResponse = {
  status: number;
  headers: Record<string, string | string[] | undefined>;
  body: Buffer;
};

type MessageRow = {
  uid: number;
  columns: { subject?: string; fromto?: string; date?: string };
  flags: { seen?: number; ctype?: string; mbox?: string };
};

function decodeHtml(value: string) {
  return value
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#039;|&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)));
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function inputValue(html: string, name: string) {
  const tag = html.match(new RegExp(`<input(?=[^>]*\\bname=["']${escapeRegex(name)}["'])[^>]*>`, "i"))?.[0] || "";
  const value = tag.match(/\bvalue=["']([^"']*)["']/i)?.[1] || "";
  return decodeHtml(value);
}

function selectValue(html: string, name: string) {
  const block = html.match(new RegExp(`<select(?=[^>]*\\bname=["']${escapeRegex(name)}["'])[^>]*>([\\s\\S]*?)<\\/select>`, "i"))?.[1] || "";
  const selected = block.match(/<option(?=[^>]*\bselected\b)[^>]*\bvalue=["']([^"']+)["'][^>]*>/i)?.[1];
  const first = block.match(/<option[^>]*\bvalue=["']([^"']+)["'][^>]*>/i)?.[1];
  return decodeHtml(selected || first || "");
}

function requestToken(html: string) {
  return decodeHtml(
    html.match(/["']request_token["']\s*:\s*["']([^"']+)["']/i)?.[1] ||
      html.match(/[?&]_token=([^&"']+)/i)?.[1] ||
      inputValue(html, "_token"),
  );
}

function extractCallArguments(source: string, functionName: string) {
  const results: string[] = [];
  const marker = `this.${functionName}(`;
  let position = 0;

  while ((position = source.indexOf(marker, position)) >= 0) {
    const start = position + marker.length;
    let depth = 1;
    let quote = "";
    let escaped = false;
    let index = start;

    for (; index < source.length; index += 1) {
      const character = source[index];
      if (quote) {
        if (escaped) escaped = false;
        else if (character === "\\") escaped = true;
        else if (character === quote) quote = "";
        continue;
      }
      if (character === '"' || character === "'") quote = character;
      else if (character === "(") depth += 1;
      else if (character === ")") {
        depth -= 1;
        if (depth === 0) break;
      }
    }

    if (depth !== 0) throw new Error(`XJOY Webmail 返回了不完整的 ${functionName} 命令`);
    results.push(source.slice(start, index));
    position = index + 1;
  }

  return results;
}

function parseMessageRows(payload: string) {
  const parsed = JSON.parse(payload) as { exec?: string };
  if (!parsed.exec) throw new Error("XJOY Webmail 未返回邮件列表");

  return extractCallArguments(parsed.exec, "add_message_row").map((argumentsSource) => {
    const values = JSON.parse(`[${argumentsSource}]`) as [number, MessageRow["columns"], MessageRow["flags"], boolean];
    return { uid: values[0], columns: values[1] || {}, flags: values[2] || {} } satisfies MessageRow;
  });
}

class RoundcubeSession {
  private cookies = new Map<string, string>();
  private token = "";
  private readonly tlsHost = process.env.MAIL_XJOY_WEBMAIL_TLS_HOST || DEFAULT_TLS_HOST;
  private readonly tenantHost = process.env.MAIL_XJOY_WEBMAIL_TENANT_HOST || DEFAULT_TENANT_HOST;

  private cookieHeader() {
    return [...this.cookies.entries()].map(([name, value]) => `${name}=${value}`).join("; ");
  }

  private rememberCookies(headers: RoundcubeResponse["headers"]) {
    const values = headers["set-cookie"];
    for (const header of Array.isArray(values) ? values : values ? [values] : []) {
      const pair = header.split(";", 1)[0];
      const separator = pair.indexOf("=");
      if (separator <= 0) continue;
      const name = pair.slice(0, separator);
      const value = pair.slice(separator + 1);
      if (value) this.cookies.set(name, value);
      else this.cookies.delete(name);
    }
  }

  private requestOnce(path: string, method: "GET" | "POST", body?: string) {
    return new Promise<RoundcubeResponse>((resolve, reject) => {
      const headers: Record<string, string | number> = {
        Host: this.tenantHost,
        "User-Agent": "XJOY Customer Service Connector/1.0",
        Accept: "*/*",
        "Accept-Encoding": "identity",
      };
      const cookie = this.cookieHeader();
      if (cookie) headers.Cookie = cookie;
      if (body != null) {
        headers["Content-Type"] = "application/x-www-form-urlencoded;charset=UTF-8";
        headers["Content-Length"] = Buffer.byteLength(body);
      }

      const request = https.request(
        {
          hostname: this.tlsHost,
          servername: this.tlsHost,
          port: 443,
          path,
          method,
          headers,
          rejectUnauthorized: true,
          timeout: 30_000,
        },
        (response) => {
          const chunks: Buffer[] = [];
          response.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
          response.on("end", () => {
            const result = {
              status: response.statusCode || 0,
              headers: response.headers,
              body: Buffer.concat(chunks),
            };
            this.rememberCookies(result.headers);
            resolve(result);
          });
        },
      );
      request.on("timeout", () => request.destroy(new Error("XJOY Webmail 请求超时")));
      request.on("error", reject);
      if (body != null) request.write(body);
      request.end();
    });
  }

  async request(path: string, method: "GET" | "POST" = "GET", body?: URLSearchParams, redirects = 0): Promise<RoundcubeResponse> {
    const encoded = body?.toString();
    const response = await this.requestOnce(path, method, encoded);
    if (response.status >= 300 && response.status < 400 && response.headers.location) {
      if (redirects >= 5) throw new Error("XJOY Webmail 重定向次数过多");
      const location = Array.isArray(response.headers.location) ? response.headers.location[0] : response.headers.location;
      const url = new URL(location, `https://${this.tenantHost}${path}`);
      const nextMethod = response.status === 307 || response.status === 308 ? method : "GET";
      return this.request(`${url.pathname}${url.search}`, nextMethod, nextMethod === "POST" ? body : undefined, redirects + 1);
    }
    if (response.status < 200 || response.status >= 300) throw new Error(`XJOY Webmail 请求失败（HTTP ${response.status}）`);
    return response;
  }

  async login() {
    const user = process.env.MAIL_XJOY_USER || "business@xjoy.ai";
    const password = process.env.MAIL_XJOY_PASSWORD || "";
    if (!user || !password) throw new Error("XJOY 邮箱账号或密码尚未配置");

    const loginPage = (await this.request("/")).body.toString("utf8");
    const form = new URLSearchParams({
      _token: inputValue(loginPage, "_token"),
      _task: inputValue(loginPage, "_task") || "login",
      _action: inputValue(loginPage, "_action") || "login",
      _timezone: inputValue(loginPage, "_timezone"),
      _url: inputValue(loginPage, "_url"),
      _user: user,
      _pass: password,
    });
    const authenticatedPage = (await this.request("/?_task=login", "POST", form)).body.toString("utf8");
    this.token = requestToken(authenticatedPage);
    if (!this.token || !this.cookies.has("roundcube_sessauth")) {
      throw new Error("XJOY Webmail 登录失败，请确认账号密码");
    }
    return authenticatedPage;
  }

  async listRows() {
    if (!this.token) await this.login();
    const path = `/?_task=mail&_action=list&_refresh=1&_mbox=INBOX&_page=1&_remote=1&_token=${encodeURIComponent(this.token)}`;
    return parseMessageRows((await this.request(path)).body.toString("utf8"));
  }

  async source(uid: number) {
    if (!this.token) await this.login();
    return (await this.request(`/?_task=mail&_action=viewsource&_uid=${uid}&_mbox=INBOX`)).body;
  }

  async send(input: { to: string; subject: string; text: string; html?: string }) {
    if (!this.token) await this.login();
    const composePage = (await this.request("/?_task=mail&_action=compose")).body.toString("utf8");
    const token = inputValue(composePage, "_token") || requestToken(composePage) || this.token;
    const id = inputValue(composePage, "_id");
    if (!token || !id) throw new Error("XJOY Webmail 无法创建写信会话");

    const form = new URLSearchParams({
      _token: token,
      _task: "mail",
      _action: "send",
      _id: id,
      _draft: inputValue(composePage, "_draft"),
      _draft_saveid: inputValue(composePage, "_draft_saveid"),
      _attachments: inputValue(composePage, "_attachments"),
      _from: selectValue(composePage, "_from"),
      _to: input.to,
      _cc: "",
      _bcc: "",
      _replyto: "",
      _followupto: "",
      _subject: input.subject,
      _is_html: input.html ? "1" : "0",
      _message: input.html || input.text,
      _framed: "1",
    });
    const response = (await this.request("/?_task=mail", "POST", form)).body.toString("utf8");
    if (!/sent_successfully|messagesent|display_message[^\n]*success/i.test(response)) {
      throw new Error("XJOY Webmail 未确认邮件发送成功");
    }
  }
}

async function concurrentMap<T, R>(items: T[], concurrency: number, work: (item: T) => Promise<R>) {
  const results = new Array<R>(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, async () => {
      while (next < items.length) {
        const index = next;
        next += 1;
        results[index] = await work(items[index]);
      }
    }),
  );
  return results;
}

export function isXjoyRoundcubeConfigured() {
  return Boolean((process.env.MAIL_XJOY_USER || "business@xjoy.ai") && process.env.MAIL_XJOY_PASSWORD);
}

export async function testXjoyRoundcube() {
  const session = new RoundcubeSession();
  await session.login();
  await session.listRows();
  return { imap: true, smtp: true, transport: "xjoy-roundcube" as const };
}

export async function listXjoyMessages(limit = 30) {
  const session = new RoundcubeSession();
  await session.login();
  const rows = (await session.listRows()).slice(0, Math.min(limit, 100));

  return concurrentMap(rows, 5, async (row) => {
    const parsed = await simpleParser(await session.source(row.uid));
    return {
      uid: row.uid,
      mailboxId: "xjoy" as const,
      projectId: "x-pink" as const,
      from: parsed.from?.value?.[0]?.address || "",
      subject: parsed.subject || decodeHtml(row.columns.subject || "") || "(无主题)",
      date: (parsed.date || new Date()).toISOString(),
      text: parsed.text || "",
      html: typeof parsed.html === "string" ? parsed.html : "",
      unread: row.flags.seen !== 1,
      attachments: parsed.attachments.map((attachment) => ({
        filename: attachment.filename || "attachment",
        contentType: attachment.contentType,
        size: attachment.size,
      })),
    };
  });
}

export async function sendXjoyMessage(input: { to: string; subject: string; text: string; html?: string }) {
  const session = new RoundcubeSession();
  await session.login();
  await session.send(input);
  return {
    messageId: `xjoy-roundcube-${Date.now()}`,
    accepted: [input.to],
    rejected: [],
  };
}
