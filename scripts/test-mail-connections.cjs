const { ImapFlow } = require("imapflow");
const nodemailer = require("nodemailer");

const requested = process.argv.slice(2).map((value) => value.toUpperCase());
const mailboxes = requested.length ? requested : ["XJOY", "KISSLY"];

function safeError(error) {
  return {
    code: error?.code || error?.serverResponseCode || null,
    authenticationFailed: Boolean(error?.authenticationFailed),
    message: error?.authenticationFailed ? "authentication failed" : String(error?.message || "connection failed").replace(/[^\x20-\x7E]/g, "").slice(0, 160),
  };
}

(async () => {
  const results = [];
  for (const id of mailboxes) {
    const prefix = `MAIL_${id}_`;
    const auth = { user: process.env[`${prefix}USER`], pass: process.env[`${prefix}PASSWORD`] };
    const result = { id: id.toLowerCase(), imap: { ok: false }, smtp: { ok: false } };
    const imap = new ImapFlow({
      host: process.env[`${prefix}IMAP_HOST`],
      port: Number(process.env[`${prefix}IMAP_PORT`]),
      secure: process.env[`${prefix}IMAP_SECURE`] === "true",
      auth,
      logger: false,
      connectionTimeout: 15000,
      greetingTimeout: 15000,
      socketTimeout: 20000,
    });
    imap.on("error", () => undefined);
    try {
      await imap.connect();
      result.imap = { ok: true };
      await imap.logout().catch(() => undefined);
    } catch (error) {
      result.imap = { ok: false, ...safeError(error) };
    }

    try {
      const smtp = nodemailer.createTransport({
        host: process.env[`${prefix}SMTP_HOST`],
        port: Number(process.env[`${prefix}SMTP_PORT`]),
        secure: process.env[`${prefix}SMTP_SECURE`] === "true",
        auth,
        connectionTimeout: 15000,
        greetingTimeout: 15000,
        socketTimeout: 20000,
      });
      await smtp.verify();
      result.smtp = { ok: true };
      smtp.close();
    } catch (error) {
      result.smtp = { ok: false, ...safeError(error) };
    }
    results.push(result);
  }
  console.log(JSON.stringify(results));
})().catch((error) => {
  console.error(JSON.stringify({ fatal: safeError(error) }));
  process.exitCode = 1;
});
