import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { collection, query, where, orderBy, getDocs, doc, getDoc } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../context/AuthContext'
import { getGlobalSettings } from '../services/globalSettings'
import { formatTime, generateCSV } from '../services/export'
import { writeAdminLog, getAdminLogs, LOG_ACTIONS, actionLabel } from '../services/adminLog'
import {
  softDeleteTrips, getDeletedTrips, restoreTrip, purgeTrips, TEN_DAYS_MS,
} from '../services/trips'
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
        q(trip.companyName),
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
  const [activityLog, setActivityLog] = useState([])
  const [logOpen, setLogOpen] = useState(false)
  const [logLoading, setLogLoading] = useState(false)
  const [binGroups, setBinGroups] = useState([])
  const [binOpen, setBinOpen] = useState(false)
  const [binLoading, setBinLoading] = useState(false)
  const [binActing, setBinActing] = useState(false)
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')

  async function loadData() {
    setLoading(true)
    setError(null)

    // Timeout so the page never hangs on a slow/missing Firestore index
    const timeout = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Request timed out. Check that Firestore indexes are deployed: run "firebase deploy --only firestore:indexes"')), 15000)
    )

    try {
      const settings = await Promise.race([getGlobalSettings(), timeout])
      setPerMileRate(settings.perMileRate ?? 0.67)

      const q = query(
        collection(db, 'trips'),
        where('status', '==', 'completed'),
        orderBy('date', 'desc')
      )
      const snap = await Promise.race([getDocs(q), timeout])
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

  async function loadLog() {
    setLogLoading(true)
    try {
      const entries = await getAdminLogs(50)
      setActivityLog(entries)
    } catch (err) {
      console.warn('Could not load admin log:', err.message)
    } finally {
      setLogLoading(false)
    }
  }

  function toggleLog() {
    if (!logOpen && activityLog.length === 0) loadLog()
    setLogOpen((v) => !v)
  }

  // ── Recycle Bin ───────────────────────────────────
  async function loadBin() {
    setBinLoading(true)
    try {
      const trips = await getDeletedTrips()
      const now = Date.now()

      // Auto-purge trips older than 10 days
      const expired = trips.filter((t) => {
        const ms = t.deletedAt?.toDate ? t.deletedAt.toDate().getTime() : 0
        return now - ms > TEN_DAYS_MS
      })
      if (expired.length > 0) await purgeTrips(expired.map((t) => t.id))

      const active = trips.filter((t) => {
        const ms = t.deletedAt?.toDate ? t.deletedAt.toDate().getTime() : 0
        return now - ms <= TEN_DAYS_MS
      })

      // Build user name map from already-loaded groups + Firestore fallback
      const nameMap = {}
      groups.forEach((g) => { nameMap[g.userId] = g.userName })
      const unknownIds = [...new Set(active.map((t) => t.userId).filter((id) => !nameMap[id]))]
      await Promise.all(unknownIds.map(async (uid) => {
        try {
          const uSnap = await getDoc(doc(db, 'users', uid))
          nameMap[uid] = uSnap.exists()
            ? uSnap.data().displayName || uSnap.data().email || uid
            : uid
        } catch { nameMap[uid] = uid }
      }))

      // Group by user
      const byUser = {}
      for (const trip of active) {
        if (!byUser[trip.userId]) {
          byUser[trip.userId] = { userId: trip.userId, userName: nameMap[trip.userId] || trip.userId, trips: [] }
        }
        byUser[trip.userId].trips.push(trip)
      }
      setBinGroups(Object.values(byUser))
    } catch (err) {
      console.warn('Could not load bin:', err.message)
    } finally {
      setBinLoading(false)
    }
  }

  function toggleBin() {
    if (!binOpen) loadBin()
    setBinOpen((v) => !v)
  }

  async function handleRestore(tripId) {
    setBinActing(true)
    try {
      await restoreTrip(tripId)
      await Promise.all([loadBin(), loadData()])
    } finally {
      setBinActing(false)
    }
  }

  async function handlePurgeOne(tripId) {
    setBinActing(true)
    try {
      await purgeTrips([tripId])
      await loadBin()
    } finally {
      setBinActing(false)
    }
  }

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

  // Filter trips within a group by date range
  function filterByDateRange(sourceGroups) {
    if (!fromDate && !toDate) return sourceGroups
    return sourceGroups.map((g) => ({
      ...g,
      trips: g.trips.filter((t) => {
        if (fromDate && t.date < fromDate) return false
        if (toDate && t.date > toDate) return false
        return true
      }),
    })).filter((g) => g.trips.length > 0)
  }

  // ── Download ──────────────────────────────────────
  async function handleDownloadAll() {
    const filtered = filterByDateRange(groups)
    const csv = buildGroupCSV(filtered, perMileRate)
    const date = new Date().toISOString().split('T')[0]
    const suffix = fromDate || toDate ? `_${fromDate || 'start'}_to_${toDate || 'end'}` : ''
    downloadCSV(csv, `mileage-all-users-${date}${suffix}.csv`)
    await writeAdminLog({
      action: LOG_ACTIONS.DOWNLOAD_ALL,
      adminEmail: currentUser.email,
      adminName: currentUser.displayName || currentUser.email,
      userNames: filtered.map((g) => g.userName),
      tripCount: filtered.reduce((s, g) => s + g.trips.length, 0),
    })
    if (logOpen) loadLog()
  }

  async function handleDownloadSelected() {
    if (!hasSelection) return
    const filtered = filterByDateRange(selectedGroups)
    const csv = buildGroupCSV(filtered, perMileRate)
    const names = filtered.map((g) => g.userName.split(' ')[0]).join('-')
    const date = new Date().toISOString().split('T')[0]
    const suffix = fromDate || toDate ? `_${fromDate || 'start'}_to_${toDate || 'end'}` : ''
    downloadCSV(csv, `mileage-${names}-${date}${suffix}.csv`)
    await writeAdminLog({
      action: LOG_ACTIONS.DOWNLOAD_SELECTED,
      adminEmail: currentUser.email,
      adminName: currentUser.displayName || currentUser.email,
      userNames: filtered.map((g) => g.userName),
      tripCount: filtered.reduce((s, g) => s + g.trips.length, 0),
    })
    if (logOpen) loadLog()
  }

  // ── Reset (soft-delete — recoverable for 10 days) ─
  async function doReset(targetGroups, action) {
    setResetting(true)
    try {
      const tripIds = targetGroups.flatMap((g) => g.trips.map((t) => t.id))
      await softDeleteTrips(tripIds)
      await writeAdminLog({
        action,
        adminEmail: currentUser.email,
        adminName: currentUser.displayName || currentUser.email,
        userNames: targetGroups.map((g) => g.userName),
        tripCount: tripIds.length,
      })
      setSelected({})
      await loadData()
      if (logOpen) loadLog()
      if (binOpen) loadBin()
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
      onConfirm: () => doReset(groups, LOG_ACTIONS.RESET_ALL),
    })
  }

  function handleResetSelected() {
    if (!hasSelection) return
    const tripCount = selectedGroups.reduce((s, g) => s + g.trips.length, 0)
    const names = selectedGroups.map((g) => g.userName).join(', ')
    setConfirm({
      message: `This will permanently delete ${tripCount} trip${tripCount !== 1 ? 's' : ''} for: ${names}. This cannot be undone.`,
      onConfirm: () => doReset(selectedGroups, LOG_ACTIONS.RESET_SELECTED),
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
    <div style={{ padding: 24, textAlign: 'center' }}>
      <div style={{ fontSize: 32, marginBottom: 12 }}>⚠️</div>
      <div style={{ color: '#c0392b', fontSize: 14, marginBottom: 16, lineHeight: 1.5 }}>
        {error}
      </div>
      <button className="btn-primary" style={{ maxWidth: 200, margin: '0 auto' }} onClick={loadData}>
        Retry
      </button>
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
          {/* Date range filter */}
          <div className="date-range-row">
            <span style={{ fontSize: 12, color: 'var(--gray-600)', fontWeight: 600, whiteSpace: 'nowrap' }}>
              Date range
            </span>
            <input
              type="date"
              className="date-range-input"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              placeholder="From"
            />
            <span style={{ fontSize: 12, color: 'var(--gray-400)' }}>–</span>
            <input
              type="date"
              className="date-range-input"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              placeholder="To"
            />
            {(fromDate || toDate) && (
              <button
                style={{ background: 'none', border: 'none', fontSize: 12, color: 'var(--gray-400)', cursor: 'pointer', padding: '0 2px' }}
                onClick={() => { setFromDate(''); setToDate('') }}
              >
                ✕
              </button>
            )}
          </div>

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

      {/* Recycle Bin */}
      <div className="activity-log-section">
        <button className="activity-log-toggle" onClick={toggleBin}>
          <span>🗑 Recycle Bin {binGroups.length > 0 ? `(${binGroups.reduce((s, g) => s + g.trips.length, 0)})` : ''}</span>
          <span>{binOpen ? '▲' : '▼'}</span>
        </button>
        {binOpen && (
          <div className="activity-log-body">
            {binLoading ? (
              <div style={{ padding: '12px 0', textAlign: 'center', color: 'var(--gray-400)', fontSize: 13 }}>
                Loading…
              </div>
            ) : binGroups.length === 0 ? (
              <div style={{ padding: '12px 0', textAlign: 'center', color: 'var(--gray-400)', fontSize: 13 }}>
                Recycle bin is empty
              </div>
            ) : binGroups.map((group) => (
              <div key={group.userId}>
                <div style={{
                  padding: '6px 16px', fontSize: 11, fontWeight: 700,
                  color: 'var(--duplo-navy)', background: 'var(--gray-50)',
                  textTransform: 'uppercase', letterSpacing: '0.04em',
                  borderBottom: '1px solid var(--gray-100)',
                }}>
                  {group.userName}
                </div>
                {group.trips.map((trip) => {
                  const deletedMs = trip.deletedAt?.toDate ? trip.deletedAt.toDate().getTime() : Date.now()
                  const daysLeft = Math.ceil((TEN_DAYS_MS - (Date.now() - deletedMs)) / 86400000)
                  return (
                    <div key={trip.id} className="bin-trip-row">
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--gray-900)' }}>
                          {trip.date} · {trip.miles} mi
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--gray-400)', marginTop: 2 }}>
                          {trip.startAddress || '?'} → {trip.endAddress || '?'}
                        </div>
                        <div style={{ fontSize: 11, color: daysLeft <= 2 ? '#c0392b' : 'var(--gray-400)', marginTop: 2, fontWeight: daysLeft <= 2 ? 700 : 400 }}>
                          {daysLeft} day{daysLeft !== 1 ? 's' : ''} until permanent deletion
                        </div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0, marginLeft: 10 }}>
                        <button
                          className="bin-btn bin-btn-restore"
                          onClick={() => handleRestore(trip.id)}
                          disabled={binActing}
                        >
                          ↩ Restore
                        </button>
                        <button
                          className="bin-btn bin-btn-purge"
                          onClick={() => handlePurgeOne(trip.id)}
                          disabled={binActing}
                        >
                          ✕ Delete
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Activity Log */}
      <div className="activity-log-section">
        <button className="activity-log-toggle" onClick={toggleLog}>
          <span>📋 Activity Log</span>
          <span>{logOpen ? '▲' : '▼'}</span>
        </button>
        {logOpen && (
          <div className="activity-log-body">
            {logLoading ? (
              <div style={{ padding: '12px 0', textAlign: 'center', color: 'var(--gray-400)', fontSize: 13 }}>
                Loading log…
              </div>
            ) : activityLog.length === 0 ? (
              <div style={{ padding: '12px 0', textAlign: 'center', color: 'var(--gray-400)', fontSize: 13 }}>
                No activity recorded yet
              </div>
            ) : (
              activityLog.map((entry) => {
                const ts = entry.timestamp?.toDate ? entry.timestamp.toDate() : new Date()
                const dateStr = ts.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                const timeStr = ts.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
                return (
                  <div key={entry.id} className="activity-log-entry">
                    <div className="activity-log-action">{actionLabel(entry.action)}</div>
                    <div className="activity-log-meta">
                      {entry.adminName || entry.adminEmail} · {dateStr} {timeStr}
                    </div>
                    <div className="activity-log-detail">
                      {entry.tripCount} trip{entry.tripCount !== 1 ? 's' : ''}
                      {entry.userNames?.length > 0 && ` · ${entry.userNames.join(', ')}`}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        )}
      </div>

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
                    {trip.companyName && (
                      <div style={{ fontSize: 11, color: 'var(--gray-400)', marginTop: 2 }}>🏢 {trip.companyName}</div>
                    )}
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
