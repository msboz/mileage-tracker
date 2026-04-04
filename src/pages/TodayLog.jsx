import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { doc, getDoc } from 'firebase/firestore'
import { useAuth } from '../context/AuthContext'
import { getTodaysTrips, getActiveTrip } from '../services/trips'
import { shareCSV } from '../services/export'
import { db } from '../firebase'
import TripCard from '../components/TripCard'

export default function TodayLog() {
  const { currentUser } = useAuth()
  const navigate = useNavigate()
  const [trips, setTrips] = useState([])
  const [activeTrip, setActiveTrip] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const [todayTrips, active] = await Promise.all([
        getTodaysTrips(currentUser.uid),
        getActiveTrip(currentUser.uid),
      ])
      if (active) {
        navigate('/in-progress', { replace: true })
        return
      }
      setTrips(todayTrips.filter((t) => t.status === 'completed'))
      setActiveTrip(active)
      setLoading(false)
    }
    load()
  }, [currentUser.uid, navigate])

  const totalMiles = trips.reduce((sum, t) => sum + (t.miles || 0), 0)
  const today = new Date().toISOString().split('T')[0]

  async function handleEmailLog() {
    const snap = await getDoc(doc(db, 'users', currentUser.uid))
    const recipientEmail = snap.data()?.recipientEmail || ''
    await shareCSV(trips, today, recipientEmail)
  }

  if (loading) return <div className="loading">Loading...</div>

  return (
    <div className="page">
      <header className="page-header">
        <h1>Today's Log</h1>
        <Link to="/settings" className="btn-icon" aria-label="Settings">⚙️</Link>
      </header>

      <div className="trip-list">
        {trips.length === 0 && (
          <p className="empty-state">No trips logged yet today</p>
        )}
        {trips.map((trip, i) => (
          <TripCard key={trip.id} trip={trip} index={i} />
        ))}
      </div>

      <div className="page-footer">
        <div className="total-miles">Total: {totalMiles} mi</div>
        <button
          className="btn-secondary"
          onClick={handleEmailLog}
          disabled={trips.length === 0}
        >
          Email Log
        </button>
        <button className="btn-primary" onClick={() => navigate('/start')}>
          + Start Trip
        </button>
      </div>
    </div>
  )
}
