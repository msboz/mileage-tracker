import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { collection, query, where, orderBy, getDocs, doc, getDoc, writeBatch } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../context/AuthContext'
import { getGlobalSettings } from '../services/globalSettings'
import { formatTime, generateCSV } from '../services/export'
import PasswordGate from '../components/PasswordGate'

// Download a CSV string as a file
function downloadCSV(csv, filename) {
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

// Build a CSV for one or more user groups
function buildGroupCSV(groups, perMileRate) {
  const allTrips = groups.flatMap((g) =>
    g.trips.map((t) => ({ ...t, _userName: g.userName }))
  )
  // Prepend a User column to the standard CSV
  const header = `User,${generateCSV([], perMileRate).split('\n')[0]}`
  const rows = groups.flatMap((g) =>
    g.trips.map((trip, i) => {
      const q = (s) => `"${(s || '').replace(/"/g, '""')}"`
      const reimb = ((trip.miles || 0) * perMileRate).toFixed(2)
      return [
        q(g.userName),
        trip.date,
        i + 1,
        formatTime(trip.startTime),
        formatTime(trip.endTime),
        trip.startOdometer,
        trip.endOdometer,
        trip.miles,
        reimb,
        q(trip.startAddress),
        q(trip.endAddress),
        q(trip.equipment),
        q(trip.notes),
      ].join(',')
    })
  )
  return [header, ...rows].join('\n')
}

function ConfirmModal({ message, onConfirm, onCancel }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 999, padding: 24,
    }}>
      <div style={{
        background: 'white', borderRadius: 16, padding: 24,
        maxWidth: 340, width: '100%', boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
      }}>
        <div style={{ fontSize: 32, textAlign: 'center', marginBottom: 12 }}>⚠️</div>
        <p style={{ fontSize: 15, color: 'var(--gray-900)', textAlign: 'center', marginBottom: 20, lineHeight: 1.5 }}>
          {message}
        </p>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn-secondary" style={{ flex: 1 }} onClick={onCancel}>Cancel</button>
          <button
            className="btn-primary"
            style={{ flex: 1, background: '#c0392b' }}
            onClick={onConfirm}
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  )
}

function AdminDashboardContent() {
  const { currentUser } = useAuth()
  const [groups, setGroups] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [sortDir, setSortDir] = useState('desc')
  const [expanded, setExpanded] = useState({})
  const [perMileRate, setPerMileRate] = useState(0.67)
  const [selected, setSelected] = useState({}) // { [userId]: true }
  const [resetting, setResetting] = useState(false)
  const [confirm, setConfirm] = useState(null) // { message, onConfirm }

  async function loadData() {
    setLoading(true)
    setError(null)
    try {
      const settings = await getGlobalSettings()
      setPerMileRate(settings.perMileRate ?? 0.67)

      const q = query(
        collection(db, 'trips'),
        where('status', '==', 'completed'),
        orderBy('date', 'desc')
      )
      const snap = await getDocs(q)
      const trips = snap.docs.map((d) => ({ id: d.id, ...d.data() }))

      const byUser = {}
      for (const trip of trips) {
        if (!byUser[trip.userId]) byUser[trip.userId] = []
        byUser[trip.userId].push(trip)
      }

      const userIds = Object.keys(byUser)
      const userNames = {}
      await Promise.all(
        userIds.map(async (uid) => {
          try {
            const uSnap = await getDoc(doc(db, 'users', uid))
            userNames[uid] = uSnap.exists()
              ? uSnap.data().displayName || uSnap.data().email || uid
              : uid
          } catch {
            userNames[uid] = uid
          }
        })
      )

      const result = userIds.map((uid) => ({
        userId: uid,
        userName: userNames[uid],
        trips: byUser[uid],
        totalMiles: byUser[uid].reduce((s, t) => s + (t.miles || 0), 0),
        latestDate: byUser[uid][0]?.date || '',
      }))

      setGroups(result)
    } catch (err) {
      console.error('Admin load error:', err)
      setError('Could not load trip data. Make sure your Google account email is listed in Admin Emails under Global Settings.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadData() }, [currentUser])

  function toggleExpand(uid) {
    setExpanded((prev) => ({ ...prev, [uid]: !prev[uid] }))
  }

  function toggleSelect(uid) {
    setSelected((prev) => ({ ...prev, [uid]: !prev[uid] }))
  }

  function selectAll() {
    const all = {}
    groups.forEach((g) => { all[g.userId] = true })
    setSelected(all)
  }

  function selectNone() { setSelected({}) }

  const selectedGroups = groups.filter((g) => selected[g.userId])
  const hasSelection = selectedGroups.length > 0

  // ── Download ──────────────────────────────────────
  function handleDownloadAll() {
    const csv = buildGroupCSV(groups, perMileRate)
    const date = new Date().toISOString().split('T')[0]
    downloadCSV(csv, `mileage-all-users-${date}.csv`)
  }

  function handleDownloadSelected() {
    if (!hasSelection) return
    const csv = buildGroupCSV(selectedGroups, perMileRate)
    const names = selectedGroups.map((g) => g.userName.split(' ')[0]).join('-')
    const date = new Date().toISOString().split('T')[0]
    downloadCSV(csv, `mileage-${names}-${date}.csv`)
  }

  // ── Reset (delete completed trips) ────────────────
  async function doReset(targetGroups, label) {
    setResetting(true)
    try {
      const tripIds = targetGroups.flatMap((g) => g.trips.map((t) => t.id))
      // Firestore batch deletes — max 500 per batch
      const BATCH_SIZE = 500
      for (let i = 0; i < tripIds.length; i += BATCH_SIZE) {
        const batch = writeBatch(db)
        tripIds.slice(i, i + BATCH_SIZE).forEach((id) => {
          batch.delete(doc(db, 'trips', id))
        })
        await batch.commit()
      }
      setSelected({})
      await loadData()
    } catch (err) {
      console.error('Reset error:', err)
      alert(`Reset failed: ${err.message}`)
    } finally {
      setResetting(false)
      setConfirm(null)
    }
  }

  function handleResetAll() {
    setConfirm({
      message: `This will permanently delete ALL ${groups.reduce((s, g) => s + g.trips.length, 0)} trips for all ${groups.length} users. This cannot be undone.`,
      onConfirm: () => doReset(groups, 'all'),
    })
  }

  function handleResetSelected() {
    if (!hasSelection) return
    const tripCount = selectedGroups.reduce((s, g) => s + g.trips.length, 0)
    const names = selectedGroups.map((g) => g.userName).join(', ')
    setConfirm({
      message: `This will permanently delete ${tripCount} trip${tripCount !== 1 ? 's' : ''} for: ${names}. This cannot be undone.`,
      onConfirm: () => doReset(selectedGroups, 'selected'),
    })
  }

  const sorted = [...groups].sort((a, b) =>
    sortDir === 'desc'
      ? b.latestDate.localeCompare(a.latestDate)
      : a.latestDate.localeCompare(b.latestDate)
  )

  const grandTotalMiles = groups.reduce((s, g) => s + g.totalMiles, 0)
  const grandTotalReimb = (grandTotalMiles * perMileRate).toFixed(2)

  if (loading) return (
    <div style={{ padding: 48, textAlign: 'center', color: 'var(--gray-400)' }}>
      Loading all trips…
    </div>
  )

  if (error) return (
    <div style={{ padding: 24, color: '#c0392b', textAlign: 'center', fontSize: 14 }}>
      {error}
    </div>
  )

  return (
    <div className="page-content">
      {confirm && (
        <ConfirmModal
          message={confirm.message}
          onConfirm={confirm.onConfirm}
          onCancel={() => setConfirm(null)}
        />
      )}

      {/* Summary bars */}
      {groups.length > 0 && (
        <div style={{ display: 'flex', gap: 10, marginBottom: 4 }}>
          <div className="total-row" style={{ flex: 1 }}>
            <span className="total-label">All Users · Miles</span>
            <span className="total-value">{grandTotalMiles.toFixed(1)}</span>
          </div>
          <div className="total-row" style={{ flex: 1, background: 'var(--duplo-blue)' }}>
            <span className="total-label">Reimbursement</span>
            <span className="total-value">${grandTotalReimb}</span>
          </div>
        </div>
      )}

      {/* Action toolbar */}
      {groups.length > 0 && (
        <div className="admin-toolbar">
          <div className="admin-toolbar-row">
            <button className="admin-btn admin-btn-primary" onClick={handleDownloadAll}>
              ⬇ Download All
            </button>
            <button
              className="admin-btn admin-btn-primary"
              onClick={handleDownloadSelected}
              disabled={!hasSelection}
            >
              ⬇ Download Selected
            </button>
          </div>
          <div className="admin-toolbar-row">
            <button
              className="admin-btn admin-btn-danger"
              onClick={handleResetAll}
              disabled={resetting}
            >
              🗑 Reset All
            </button>
            <button
              className="admin-btn admin-btn-danger"
              onClick={handleResetSelected}
              disabled={!hasSelection || resetting}
            >
              🗑 Reset Selected
            </button>
          </div>
          <div style={{ display: 'flex', gap: 12, paddingTop: 2 }}>
            <button className="admin-select-btn" onClick={selectAll}>Select All</button>
            <button className="admin-select-btn" onClick={selectNone}>Select None</button>
            {hasSelection && (
              <span style={{ fontSize: 12, color: 'var(--duplo-blue)', fontWeight: 600, marginLeft: 'auto', alignSelf: 'center' }}>
                {selectedGroups.length} selected
              </span>
            )}
          </div>
        </div>
      )}

      {/* Sort bar */}
      <div className="admin-sort-bar">
        <span style={{ fontSize: 13, color: 'var(--gray-600)' }}>Sort:</span>
        <select value={sortDir} onChange={(e) => setSortDir(e.target.value)}>
          <option value="desc">Newest First</option>
          <option value="asc">Oldest First</option>
        </select>
        <span style={{ fontSize: 12, color: 'var(--gray-400)', marginLeft: 'auto' }}>
          {groups.length} user{groups.length !== 1 ? 's' : ''} · ${perMileRate.toFixed(2)}/mi
        </span>
      </div>

      {sorted.length === 0 && (
        <div className="empty-state">
          <span className="empty-icon">📋</span>
          <span>No completed trips found</span>
        </div>
      )}

      {sorted.map((group) => {
        const reimb = (group.totalMiles * perMileRate).toFixed(2)
        const isOpen = expanded[group.userId]
        const isSelected = !!selected[group.userId]
        const tripsByDate = [...group.trips].sort((a, b) =>
          sortDir === 'desc'
            ? b.date.localeCompare(a.date)
            : a.date.localeCompare(b.date)
        )

        return (
          <div
            key={group.userId}
            className="admin-user-group"
            style={{ borderLeft: isSelected ? '4px solid var(--duplo-blue)' : undefined }}
          >
            <div className="admin-group-header">
              {/* Checkbox */}
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => toggleSelect(group.userId)}
                onClick={(e) => e.stopPropagation()}
                style={{ width: 18, height: 18, flexShrink: 0, accentColor: 'var(--duplo-navy)', cursor: 'pointer' }}
              />
              {/* Name + meta — tap to expand */}
              <div style={{ flex: 1, cursor: 'pointer' }} onClick={() => toggleExpand(group.userId)}>
                <div className="admin-group-name">{group.userName}</div>
                <div className="admin-group-meta">
                  {group.trips.length} trip{group.trips.length !== 1 ? 's' : ''} · latest {group.latestDate}
                </div>
              </div>
              <div className="admin-group-totals" style={{ cursor: 'pointer' }} onClick={() => toggleExpand(group.userId)}>
                <div className="admin-group-miles">{group.totalMiles.toFixed(1)} mi</div>
                <div className="admin-group-reimb">${reimb}</div>
              </div>
              <span
                style={{ marginLeft: 10, color: 'var(--gray-400)', fontSize: 16, cursor: 'pointer' }}
                onClick={() => toggleExpand(group.userId)}
              >
                {isOpen ? '▲' : '▼'}
              </span>
            </div>

            {isOpen && tripsByDate.map((trip) => {
              const tripReim = ((trip.miles || 0) * perMileRate).toFixed(2)
              const from = trip.startAddress || '?'
              const to = trip.endAddress || '?'
              return (
                <div key={trip.id} className="admin-trip-row">
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 11, color: 'var(--gray-400)', marginBottom: 2 }}>
                      {trip.date} · {formatTime(trip.startTime)} – {formatTime(trip.endTime)}
                    </div>
                    <div className="admin-trip-route">{from} → {to}</div>
                    {trip.equipment && (
                      <div style={{ fontSize: 11, color: 'var(--gray-400)', marginTop: 2 }}>🚗 {trip.equipment}</div>
                    )}
                    {trip.notes && (
                      <div style={{ fontSize: 11, color: 'var(--gray-400)', marginTop: 1 }}>📝 {trip.notes}</div>
                    )}
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 12 }}>
                    <div style={{ fontWeight: 700, color: 'var(--duplo-navy)', fontSize: 15 }}>
                      {trip.miles} mi
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--success)', fontWeight: 600 }}>
                      ${tripReim}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}

export default function AdminDashboard() {
  const navigate = useNavigate()

  return (
    <div className="page">
      <nav className="top-bar">
        <button className="btn-back-nav" onClick={() => navigate('/')}>←</button>
        <img src="/duplo-logo.png" alt="Duplo" className="top-bar-logo" />
        <span className="top-bar-title">Admin Dashboard</span>
      </nav>
      <PasswordGate
        sessionKey="adminUnlocked"
        title="Admin Access"
        description="This area is for Duplo mileage managers only."
      >
        <AdminDashboardContent />
      </PasswordGate>
    </div>
  )
}
