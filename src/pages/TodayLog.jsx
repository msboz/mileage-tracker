import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getTodaysTrips, getActiveTrip } from '../services/trips'
import { shareCSV } from '../services/export'
import { getGlobalSettings } from '../services/globalSettings'
import TripCard from '../components/TripCard'

export default function TodayLog() {
  const { currentUser } = useAuth()
  const navigate = useNavigate()
  const [trips, setTrips] = useState([])
  const [loading, setLoading] = useState(true)
  const [globalSettings, setGlobalSettings] = useState(null)

  useEffect(() => {
    async function load() {
      try {
        const [todayTrips, active, settings] = await Promise.all([
          getTodaysTrips(currentUser.uid),
          getActiveTrip(currentUser.uid),
          getGlobalSettings(),
        ])
        if (active) {
          navigate('/in-progress', { replace: true })
          return
        }
        setTrips(todayTrips.filter((t) => t.status === 'completed'))
        setGlobalSettings(settings)
      } catch (err) {
        console.error('Failed to load trips:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [currentUser.uid, navigate])

  const perMileRate = globalSettings?.perMileRate ?? 0.67
  const totalMiles = trips.reduce((sum, t) => sum + (t.miles || 0), 0)
  const totalReimb = (totalMiles * perMileRate).toFixed(2)
  const today = new Date().toISOString().split('T')[0]

  async function handleEmailLog() {
    const settings = globalSettings || await getGlobalSettings()
    await shareCSV(
      trips,
      today,
      settings.recipientEmail,
      settings.perMileRate ?? 0.67,
      currentUser.displayName || currentUser.email || ''
    )
  }

  if (loading) return (
    <div className="loading">
      <img src="/duplo-logo.png" alt="Duplo" className="loading-logo" />
      <span className="loading-text">Loading...</span>
    </div>
  )

  return (
    <div className="page">
      <nav className="top-bar">
        <img src="/duplo-logo.png" alt="Duplo" className="top-bar-logo" />
        <span className="top-bar-title">Today's Log</span>
        <Link to="/settings" className="top-bar-action" aria-label="Settings">⚙️</Link>
      </nav>

      <div className="page-content">
        {trips.length === 0 ? (
          <div className="empty-state">
            <span className="empty-icon">🚗</span>
            <span>No trips logged yet today</span>
            <span style={{ fontSize: 13 }}>Tap Start Trip to begin</span>
          </div>
        ) : (
          <div className="trip-list">
            {trips.map((trip, i) => (
              <TripCard
                key={trip.id}
                trip={trip}
                index={i}
                perMileRate={perMileRate}
              />
            ))}
          </div>
        )}
      </div>

      <div className="page-footer">
        <div className="total-row">
          <span className="total-label">Total Miles Today</span>
          <span className="total-value">{totalMiles} mi</span>
        </div>
        {totalMiles > 0 && (
          <div className="total-row" style={{ background: 'var(--duplo-blue)' }}>
            <span className="total-label">Reimbursement</span>
            <span className="total-value">${totalReimb}</span>
          </div>
        )}
        <button
          className="btn-secondary"
          onClick={handleEmailLog}
          disabled={trips.length === 0}
        >
          📧 Email Log
        </button>
        <button className="btn-primary" onClick={() => navigate('/start')}>
          + Start Trip
        </button>
      </div>
    </div>
  )
}
