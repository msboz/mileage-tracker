import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getActiveTrip, getTodaysTrips } from '../services/trips'
import { formatTime } from '../services/export'
import TripCard from '../components/TripCard'

export default function TripInProgress() {
  const { currentUser } = useAuth()
  const navigate = useNavigate()
  const [activeTrip, setActiveTrip] = useState(null)
  const [completedTrips, setCompletedTrips] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const [active, today] = await Promise.all([
        getActiveTrip(currentUser.uid),
        getTodaysTrips(currentUser.uid),
      ])
      if (!active) {
        navigate('/', { replace: true })
        return
      }
      setActiveTrip(active)
      setCompletedTrips(today.filter((t) => t.status === 'completed'))
      setLoading(false)
    }
    load()
  }, [currentUser.uid, navigate])

  if (loading) return <div className="loading">Loading...</div>
  if (!activeTrip) return null

  const from = activeTrip.startName || activeTrip.startAddress || 'Unknown'

  return (
    <div className="page">
      <header className="page-header">
        <h1>Trip In Progress</h1>
      </header>

      <div className="active-trip-banner">
        <div className="active-label">Started at {formatTime(activeTrip.startTime)}</div>
        <div className="active-from">From: {from}</div>
        <div className="active-odometer">Odometer: {activeTrip.startOdometer}</div>
      </div>

      <button
        className="btn-primary btn-large"
        onClick={() => navigate('/end', { state: { activeTrip } })}
      >
        End Trip
      </button>

      {completedTrips.length > 0 && (
        <>
          <h2 style={{ fontSize: 17, fontWeight: 600, marginBottom: 10 }}>Earlier Today</h2>
          <div className="trip-list">
            {completedTrips.map((trip, i) => (
              <TripCard key={trip.id} trip={trip} index={i} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
