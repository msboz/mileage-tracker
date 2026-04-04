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

  if (loading) return (
    <div className="loading">
      <img src="/duplo-logo.png" alt="Duplo" className="loading-logo" />
      <span className="loading-text">Loading...</span>
    </div>
  )
  if (!activeTrip) return null

  const from = activeTrip.startName || activeTrip.startAddress || 'Unknown'

  return (
    <div className="page">
      <nav className="top-bar">
        <img src="/duplo-logo.png" alt="Duplo" className="top-bar-logo" />
        <span className="top-bar-title">Trip In Progress</span>
      </nav>

      <div className="page-content">
        <div className="active-trip-banner">
          <div className="active-label">
            <span className="pulse-dot" />
            Started at {formatTime(activeTrip.startTime)}
          </div>
          <div className="active-from">{from}</div>
          <div className="active-odometer">Odometer: {activeTrip.startOdometer}</div>
        </div>

        <button
          className="btn-primary btn-large"
          style={{ marginTop: 12 }}
          onClick={() => navigate('/end', { state: { activeTrip } })}
        >
          ■ End Trip
        </button>

        {completedTrips.length > 0 && (
          <>
            <p className="section-label">Earlier Today</p>
            <div className="trip-list">
              {completedTrips.map((trip, i) => (
                <TripCard key={trip.id} trip={trip} index={i} />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
