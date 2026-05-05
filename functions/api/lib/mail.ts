import { connect } from 'cloudflare:sockets'
import type { Env } from './types'

type MailResult = { ok: true } | { ok: false; error: string }

type SendMailOptions = {
  to: string
  subject: string
  html: string
}

type SmtpConfig = {
  host: string
  port: number
  username: string
  password: string
  fromEmail: string
  fromName: string
}

function getSmtpConfig(env: Env): SmtpConfig | null {
  const host = env.SMTP_HOST?.trim()
  const username = env.SMTP_USERNAME?.trim()
  const password = env.SMTP_PASSWORD?.trim()
  const fromEmail = env.SMTP_FROM_EMAIL?.trim() || username
  const fromName = env.SMTP_FROM_NAME?.trim() || 'Supplement Stack'
  const port = Number(env.SMTP_PORT ?? 465)

  if (!host || !username || !password || !fromEmail || !Number.isInteger(port) || port <= 0) {
    return null
  }

  return { host, port, username, password, fromEmail, fromName }
}

function base64Utf8(value: string): string {
  const bytes = new TextEncoder().encode(value)
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

function encodeHeader(value: string): string {
  return /^[\x20-\x7e]*$/.test(value) ? value : `=?UTF-8?B?${base64Utf8(value)}?=`
}

function formatAddress(name: string, email: string): string {
  return `${encodeHeader(name)} <${email}>`
}

function foldBase64(value: string): string {
  const chunks: string[] = []
  for (let i = 0; i < value.length; i += 76) chunks.push(value.slice(i, i + 76))
  return chunks.join('\r\n')
}

function buildMessage(config: SmtpConfig, options: SendMailOptions): string {
  const messageId = `${crypto.randomUUID()}@supplementstack.de`
  const body = foldBase64(base64Utf8(options.html))
  return [
    `From: ${formatAddress(config.fromName, config.fromEmail)}`,
    `To: ${options.to}`,
    `Subject: ${encodeHeader(options.subject)}`,
    `Date: ${new Date().toUTCString()}`,
    `Message-ID: <${messageId}>`,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    body,
    '',
  ].join('\r\n')
}

function escapeSmtpAddress(email: string): string {
  return email.replace(/[<>\r\n]/g, '')
}

class SmtpConnection {
  private decoder = new TextDecoder()
  private encoder = new TextEncoder()
  private buffer = ''

  constructor(
    private reader: ReadableStreamDefaultReader<Uint8Array>,
    private writer: WritableStreamDefaultWriter<Uint8Array>,
  ) {}

  async command(line: string, expected: number): Promise<void> {
    await this.writer.write(this.encoder.encode(`${line}\r\n`))
    await this.expect(expected)
  }

  async data(message: string): Promise<void> {
    await this.command('DATA', 354)
    const dotStuffed = message
      .split('\r\n')
      .map((line) => (line.startsWith('.') ? `.${line}` : line))
      .join('\r\n')
    await this.writer.write(this.encoder.encode(`${dotStuffed}\r\n.\r\n`))
    await this.expect(250)
  }

  async expect(expected: number): Promise<void> {
    const response = await this.readResponse()
    if (response.code !== expected) {
      throw new Error(`SMTP expected ${expected}, got ${response.code}: ${response.text}`)
    }
  }

  async close(): Promise<void> {
    try {
      await this.command('QUIT', 221)
    } finally {
      this.writer.releaseLock()
      this.reader.releaseLock()
    }
  }

  private async readResponse(): Promise<{ code: number; text: string }> {
    while (true) {
      const lines = this.buffer.split(/\r\n/)
      for (let i = 0; i < lines.length - 1; i += 1) {
        const line = lines[i]
        const match = /^(\d{3})([ -])/.exec(line)
        if (match && match[2] === ' ') {
          const responseLines = lines.slice(0, i + 1)
          this.buffer = lines.slice(i + 1).join('\r\n')
          return { code: Number(match[1]), text: responseLines.join('\n') }
        }
      }

      const chunk = await this.reader.read()
      if (chunk.done) throw new Error('SMTP connection closed before response completed')
      this.buffer += this.decoder.decode(chunk.value, { stream: true })
    }
  }
}

export async function sendMail(env: Env, options: SendMailOptions): Promise<MailResult> {
  const config = getSmtpConfig(env)
  if (!config) return { ok: false, error: 'SMTP ist nicht vollständig konfiguriert.' }

  let smtp: SmtpConnection | null = null
  try {
    const socket = connect(
      { hostname: config.host, port: config.port },
      { secureTransport: 'on', allowHalfOpen: false },
    )
    smtp = new SmtpConnection(socket.readable.getReader(), socket.writable.getWriter())
    await smtp.expect(220)
    await smtp.command('EHLO supplementstack.de', 250)
    await smtp.command('AUTH LOGIN', 334)
    await smtp.command(base64Utf8(config.username), 334)
    await smtp.command(base64Utf8(config.password), 235)
    await smtp.command(`MAIL FROM:<${escapeSmtpAddress(config.fromEmail)}>`, 250)
    await smtp.command(`RCPT TO:<${escapeSmtpAddress(options.to)}>`, 250)
    await smtp.data(buildMessage(config, options))
    await smtp.close()
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'SMTP-Versand fehlgeschlagen.' }
  } finally {
    smtp = null
  }
}

export async function sendPasswordResetEmail(
  env: Env,
  frontendUrl: string,
  toEmail: string,
  resetToken: string,
): Promise<MailResult> {
  const resetUrl = `${frontendUrl}/reset-password?token=${resetToken}`
  return sendMail(env, {
    to: toEmail,
    subject: 'Passwort zurücksetzen',
    html: `
      <p>Hallo,</p>
      <p>du hast eine Passwort-Zurücksetzen-Anfrage gestellt.</p>
      <p><a href="${resetUrl}" style="background:#2563eb;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;display:inline-block;">Passwort zurücksetzen</a></p>
      <p>Oder kopiere diesen Link: ${resetUrl}</p>
      <p>Der Link ist 1 Stunde gültig. Falls du keine Anfrage gestellt hast, ignoriere diese Mail.</p>
    `,
  })
}
