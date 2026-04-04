import { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { endTrip, getActiveTrip } from '../services/trips'
import { getCurrentLocation } from '../services/location'

export default function EndTrip() {
  const { currentUser } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [activeTrip, setActiveTrip] = useState(location.state?.activeTrip || null)
  const [odometer, setOdometer] = useState('')
  const [address, setAddress] = useState('')
  const [locationName, setLocationName] = useState('')
  const [locating, setLocating] = useState(true)
  const [saving, setSaving] = useState(false)
  const now = new Date()

  useEffect(() => {
    async function init() {
      if (!activeTrip) {
        const active = await getActiveTrip(currentUser.uid)
        if (!active) {
          navigate('/', { replace: true })
          return
        }
        setActiveTrip(active)
      }
      try {
        const loc = await getCurrentLocation()
        setAddress(loc.address)
      } catch {
        // Location permission denied — user can type manually
      }
      setLocating(false)
    }
    init()
  }, [currentUser.uid, navigate, activeTrip])

  async function handleSave() {
    if (!odometer || !activeTrip) return
    setSaving(true)
    await endTrip(activeTrip.id, {
      endOdometer: Number(odometer),
      endAddress: address,
      endName: locationName,
      startOdometer: activeTrip.startOdometer,
    })
    navigate('/', { replace: true })
  }

  return (
    <div className="page">
      <nav className="top-bar">
        <button className="btn-back-nav" onClick={() => navigate(-1)}>←</button>
        <img src="/duplo-logo.png" alt="Duplo" className="top-bar-logo" />
        <span className="top-bar-title">End Trip</span>
      </nav>

      <div className="page-content">
        <div className="form">
          <label>Date &amp; Time</label>
          <input value={now.toLocaleString()} readOnly className="input-readonly" />

          <label>Odometer *</label>
          <input
            type="number"
            inputMode="numeric"
            value={odometer}
            onChange={(e) => setOdometer(e.target.value)}
            placeholder="Current odometer reading"
            className="input"
            autoFocus
          />

          <label>Location {locating ? '(detecting…)' : ''}</label>
          <input
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Address"
            className="input"
          />

          <label>Location Name (optional)</label>
          <input
            value={locationName}
            onChange={(e) => setLocationName(e.target.value)}
            placeholder="e.g. ABC Company"
            className="input"
          />
        </div>
      </div>

      <div className="page-footer">
        <button
          className="btn-primary"
          onClick={handleSave}
          disabled={!odometer || saving}
        >
          {saving ? 'Saving…' : '✓ Save Trip'}
        </button>
      </div>
    </div>
  )
}
