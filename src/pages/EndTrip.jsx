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
  const [equipment, setEquipment] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

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
        // Location captured silently in background
      }
    }
    init()
  }, [currentUser.uid, navigate, activeTrip])

  async function handleSave() {
    if (!odometer || !activeTrip) return
    setSaving(true)
    await endTrip(activeTrip.id, {
      endOdometer: Number(odometer),
      endAddress: address,
      endName: '',
      startOdometer: activeTrip.startOdometer,
      equipment: equipment.trim(),
      notes: notes.trim(),
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

          <label>Equipment (optional)</label>
          <input
            value={equipment}
            onChange={(e) => setEquipment(e.target.value)}
            placeholder="e.g. Truck, Van, Trailer"
            className="input"
          />

          <label>Notes (optional)</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Any notes for this trip…"
            className="input"
            rows={3}
            style={{ resize: 'none' }}
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
