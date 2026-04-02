import {
  collection, addDoc, updateDoc, doc,
  query, where, orderBy, limit, getDocs, Timestamp,
} from 'firebase/firestore'
import { db } from '../firebase'

export async function startTrip({ userId, startOdometer, startAddress, startName }) {
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
  }
  const ref = await addDoc(collection(db, 'trips'), trip)
  return { id: ref.id, ...trip }
}

export async function endTrip(tripId, { endOdometer, endAddress, endName, startOdometer }) {
  const now = Timestamp.now()
  const miles = endOdometer - startOdometer
  const updates = {
    endTime: now,
    endOdometer,
    endAddress: endAddress || '',
    endName: endName || '',
    miles,
    status: 'completed',
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
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}

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
