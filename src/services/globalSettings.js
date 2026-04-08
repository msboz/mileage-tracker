import { doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from '../firebase'

const DEFAULTS = {
  recipientEmail: '',
  perMileRate: 0.67,
  adminEmails: [],
  adminPasswordHash: '', // empty = fall back to 'Duplo123'
}

export async function hashPassword(password) {
  const encoder = new TextEncoder()
  const data = encoder.encode(password)
  const hash = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

const DEFAULT_PASSWORD = 'Duplo123'

export async function verifyPassword(input, storedHash) {
  if (!storedHash) {
    // No custom password set yet — compare against factory default
    return input === DEFAULT_PASSWORD
  }
  const inputHash = await hashPassword(input)
  return inputHash === storedHash
}

let _cache = null
let _pending = null // prevent duplicate in-flight fetches

export async function getGlobalSettings() {
  if (_cache) return _cache
  if (_pending) return _pending
  _pending = (async () => {
    try {
      const snap = await getDoc(doc(db, 'globalSettings', 'config'))
      _cache = snap.exists() ? { ...DEFAULTS, ...snap.data() } : { ...DEFAULTS }
    } catch (err) {
      console.warn('Could not load global settings, using defaults:', err.message)
      _cache = { ...DEFAULTS }
    } finally {
      _pending = null
    }
    return _cache
  })()
  return _pending
}

export function clearGlobalSettingsCache() {
  _cache = null
}

export async function saveGlobalSettings(data) {
  clearGlobalSettingsCache()
  await setDoc(doc(db, 'globalSettings', 'config'), data, { merge: true })
}
