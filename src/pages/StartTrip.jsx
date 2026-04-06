import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { startTrip, getLastOdometer } from '../services/trips'
import { getCurrentLocation } from '../services/location'

export default function StartTrip() {
  const { currentUser } = useAuth()
  const navigate = useNavigate()
  const [odometer, setOdometer] = useState('')
  const [address, setAddress] = useState('')
  const [equipment, setEquipment] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    async function init() {
      const [lastOdo, loc] = await Promise.allSettled([
        getLastOdometer(currentUser.uid),
        getCurrentLocation(),
      ])
      if (lastOdo.status === 'fulfilled' && lastOdo.value !== null) {
        setOdometer(String(lastOdo.value))
      }
      if (loc.status === 'fulfilled') {
        setAddress(loc.value.address)
      }
    }
    init()
  }, [currentUser.uid])

  async function handleStart() {
    if (!odometer) return
    setSaving(true)
    await startTrip({
      userId: currentUser.uid,
      startOdometer: Number(odometer),
      startAddress: address,
      startName: '',
      equipment: equipment.trim(),
      notes: notes.trim(),
    })
    navigate('/in-progress', { replace: true })
  }

  return (
    <div className="page">
      <nav className="top-bar">
        <button className="btn-back-nav" onClick={() => navigate(-1)}>←</button>
        <img src="/duplo-logo.png" alt="Duplo" className="top-bar-logo" />
        <span className="top-bar-title">Start Trip</span>
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
          onClick={handleStart}
          disabled={!odometer || saving}
        >
          {saving ? 'Starting…' : '▶ Start Trip'}
        </button>
      </div>
    </div>
  )
}
