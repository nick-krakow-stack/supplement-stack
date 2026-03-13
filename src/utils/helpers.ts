// Supplement Stack - Utility Functions
import type { Bindings } from '../types'

// ========================
// PASSWORD HASHING (SHA-256 + Salt)
// ========================

export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder()
  const salt = generateSecureToken().substring(0, 16)
  const saltedPassword = password + salt
  const data = encoder.encode(saltedPassword)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
  return salt + hashHex
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  try {
    const encoder = new TextEncoder()
    const salt = hash.substring(0, 16)
    const storedHash = hash.substring(16)
    const saltedPassword = password + salt
    const data = encoder.encode(saltedPassword)
    const hashBuffer = await crypto.subtle.digest('SHA-256', data)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    const computedHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
    return computedHash === storedHash
  } catch {
    return false
  }
}

// ========================
// TOKEN GENERATION
// ========================

export function generateSecureToken(): string {
  const array = new Uint8Array(32)
  crypto.getRandomValues(array)
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('')
}

// ========================
// VALIDATION
// ========================

export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

export function validatePassword(password: string): { valid: boolean; message?: string } {
  if (password.length < 8) {
    return { valid: false, message: 'Passwort muss mindestens 8 Zeichen lang sein' }
  }
  if (!/[A-Z]/.test(password)) {
    return { valid: false, message: 'Passwort muss mindestens einen Großbuchstaben enthalten' }
  }
  if (!/[a-z]/.test(password)) {
    return { valid: false, message: 'Passwort muss mindestens einen Kleinbuchstaben enthalten' }
  }
  if (!/[0-9]/.test(password)) {
    return { valid: false, message: 'Passwort muss mindestens eine Zahl enthalten' }
  }
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>?]/.test(password)) {
    return { valid: false, message: 'Passwort muss mindestens ein Sonderzeichen enthalten' }
  }
  return { valid: true }
}

// ========================
// EMAIL SENDING (MailerSend)
// ========================

export async function sendEmail(
  apiKey: string,
  to: string,
  subject: string,
  html: string,
  text: string
): Promise<void> {
  const response = await fetch('https://api.mailersend.com/v1/email', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: { email: 'noreply@supplementstack.de', name: 'Supplement Stack' },
      to: [{ email: to }],
      subject,
      html,
      text
    })
  })
  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`MailerSend API Error: ${response.status} - ${errorText}`)
  }
}

// ========================
// UNIFIED API RESPONSE HELPER
// ========================

export function apiSuccess<T>(data: T, message?: string) {
  return { success: true as const, data, message }
}

export function apiError(error: string, message?: string) {
  return { success: false as const, error, message }
}
