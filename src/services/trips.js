import {
  collection, addDoc, updateDoc, doc,
  query, where, orderBy, limit, getDocs, Timestamp,
  writeBatch, deleteField,
} from 'firebase/firestore'
import { db } from '../firebase'

const TEN_DAYS_MS = 10 * 24 * 60 * 60 * 1000

export async function startTrip({ userId, startOdometer, startAddress, startName, equipment, notes }) {
  const now = Timestamp.now()
  const date = now.toDate().toISOString().split('T')[0]
  const trip = {
    userId,
    date,
    startTime: now,
    startOdometer,
    startAddress: startAddress || '',
    startName: startName || '',
    endTime: null,
    endOdometer: null,
    endAddress: null,
    endName: null,
    miles: null,
    status: 'in-progress',
    equipment: equipment || '',
    notes: notes || '',
  }
  const ref = await addDoc(collection(db, 'trips'), trip)
  return { id: ref.id, ...trip }
}

export async function endTrip(tripId, { endOdometer, endAddress, endName, startOdometer, companyName, equipment, notes }) {
  const now = Timestamp.now()
  const miles = endOdometer - startOdometer
  const updates = {
    endTime: now,
    endOdometer,
    endAddress: endAddress || '',
    endName: endName || '',
    miles,
    status: 'completed',
    companyName: companyName || '',
    equipment: equipment || '',
    notes: notes || '',
  }
  await updateDoc(doc(db, 'trips', tripId), updates)
  return updates
}

export async function getTodaysTrips(userId) {
  const today = new Date().toISOString().split('T')[0]
  const q = query(
    collection(db, 'trips'),
    where('userId', '==', userId),
    where('date', '==', today),
    orderBy('startTime', 'asc')
  )
  const snap = await getDocs(q)
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((t) => t.status !== 'deleted')
}

// ── Soft delete (10-day recoverable) ─────────────────
export async function softDeleteTrips(tripIds) {
  const now = Timestamp.now()
  const BATCH_SIZE = 500
  for (let i = 0; i < tripIds.length; i += BATCH_SIZE) {
    const batch = writeBatch(db)
    tripIds.slice(i, i + BATCH_SIZE).forEach((id) => {
      batch.update(doc(db, 'trips', id), { status: 'deleted', deletedAt: now })
    })
    await batch.commit()
  }
}

// Fetch all soft-deleted trips (admin use — no userId filter)
export async function getDeletedTrips() {
  const q = query(
    collection(db, 'trips'),
    where('status', '==', 'deleted'),
    orderBy('deletedAt', 'desc')
  )
  const snap = await getDocs(q)
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}

// Restore a single trip back to completed
export async function restoreTrip(tripId) {
  await updateDoc(doc(db, 'trips', tripId), {
    status: 'completed',
    deletedAt: deleteField(),
  })
}

// Permanently delete trips from Firestore
export async function purgeTrips(tripIds) {
  const BATCH_SIZE = 500
  for (let i = 0; i < tripIds.length; i += BATCH_SIZE) {
    const batch = writeBatch(db)
    tripIds.slice(i, i + BATCH_SIZE).forEach((id) => {
      batch.delete(doc(db, 'trips', id))
    })
    await batch.commit()
  }
}

export { TEN_DAYS_MS }

export async function getActiveTrip(userId) {
  const q = query(
    collection(db, 'trips'),
    where('userId', '==', userId),
    where('status', '==', 'in-progress'),
    limit(1)
  )
  const snap = await getDocs(q)
  if (snap.empty) return null
  return { id: snap.docs[0].id, ...snap.docs[0].data() }
}

export async function getLastOdometer(userId) {
  const q = query(
    collection(db, 'trips'),
    where('userId', '==', userId),
    where('status', '==', 'completed'),
    orderBy('endTime', 'desc'),
    limit(1)
  )
  const snap = await getDocs(q)
  if (snap.empty) return null
  return snap.docs[0].data().endOdometer
}
