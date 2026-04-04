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
  const [locationName, setLocationName] = useState('')
  const [locating, setLocating] = useState(true)
  const [saving, setSaving] = useState(false)
  const now = new Date()

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
      setLocating(false)
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
      startName: locationName,
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
            placeholder="e.g. Home Office"
            className="input"
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
