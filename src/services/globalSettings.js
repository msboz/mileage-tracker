import { doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from '../firebase'

const DEFAULTS = {
  recipientEmail: '',
  perMileRate: 0.67,
  adminEmails: [],
}

let _cache = null

export async function getGlobalSettings() {
  if (_cache) return _cache
  const snap = await getDoc(doc(db, 'globalSettings', 'config'))
  _cache = snap.exists() ? { ...DEFAULTS, ...snap.data() } : { ...DEFAULTS }
  return _cache
}

export function clearGlobalSettingsCache() {
  _cache = null
}

export async function saveGlobalSettings(data) {
  clearGlobalSettingsCache()
  await setDoc(doc(db, 'globalSettings', 'config'), data, { merge: true })
}
