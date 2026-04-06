import { collection, addDoc, query, orderBy, limit, getDocs, Timestamp } from 'firebase/firestore'
import { db } from '../firebase'

export const LOG_ACTIONS = {
  DOWNLOAD_ALL:      'download_all',
  DOWNLOAD_SELECTED: 'download_selected',
  RESET_ALL:         'reset_all',
  RESET_SELECTED:    'reset_selected',
}

const ACTION_LABELS = {
  download_all:      'Downloaded All Users',
  download_selected: 'Downloaded Selected Users',
  reset_all:         'Reset All Users',
  reset_selected:    'Reset Selected Users',
}

export function actionLabel(action) {
  return ACTION_LABELS[action] || action
}

/**
 * Write an admin audit log entry to Firestore.
 * @param {object} params
 * @param {string} params.action      - One of LOG_ACTIONS
 * @param {string} params.adminEmail
 * @param {string} params.adminName
 * @param {string[]} params.userNames - Affected user display names
 * @param {number} params.tripCount   - Number of trips affected
 */
export async function writeAdminLog({ action, adminEmail, adminName, userNames, tripCount }) {
  try {
    await addDoc(collection(db, 'adminLogs'), {
      action,
      adminEmail: adminEmail || '',
      adminName:  adminName  || '',
      userNames:  userNames  || [],
      tripCount:  tripCount  || 0,
      timestamp:  Timestamp.now(),
    })
  } catch (err) {
    // Non-fatal — logging should never break the main action
    console.warn('Failed to write admin log:', err.message)
  }
}

/**
 * Fetch the most recent admin log entries.
 * @param {number} maxEntries
 */
export async function getAdminLogs(maxEntries = 50) {
  const q = query(
    collection(db, 'adminLogs'),
    orderBy('timestamp', 'desc'),
    limit(maxEntries)
  )
  const snap = await getDocs(q)
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}
