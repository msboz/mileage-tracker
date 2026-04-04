import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { collection, query, where, orderBy, getDocs, doc, getDoc } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../context/AuthContext'
import { getGlobalSettings } from '../services/globalSettings'
import { formatTime } from '../services/export'
import PasswordGate from '../components/PasswordGate'

function AdminDashboardContent() {
  const { currentUser } = useAuth()
  const [groups, setGroups] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [sortDir, setSortDir] = useState('desc')
  const [expanded, setExpanded] = useState({})
  const [perMileRate, setPerMileRate] = useState(0.67)

  useEffect(() => {
    async function load() {
      try {
        const settings = await getGlobalSettings()
        setPerMileRate(settings.perMileRate ?? 0.67)

        // Query ALL completed trips (Firestore rules allow admins via adminEmails)
        const q = query(
          collection(db, 'trips'),
          where('status', '==', 'completed'),
          orderBy('date', 'desc')
        )
        const snap = await getDocs(q)
        const trips = snap.docs.map((d) => ({ id: d.id, ...d.data() }))

        // Group by userId
        const byUser = {}
        for (const trip of trips) {
          if (!byUser[trip.userId]) byUser[trip.userId] = []
          byUser[trip.userId].push(trip)
        }

        // Fetch display names from users collection
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
        setError(
          'Could not load trip data. Make sure your Google account email is listed in Admin Emails under Global Settings.'
        )
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [currentUser])

  function toggleExpand(uid) {
    setExpanded((prev) => ({ ...prev, [uid]: !prev[uid] }))
  }

  const sorted = [...groups].sort((a, b) =>
    sortDir === 'desc'
      ? b.latestDate.localeCompare(a.latestDate)
      : a.latestDate.localeCompare(b.latestDate)
  )

  const grandTotalMiles = groups.reduce((s, g) => s + g.totalMiles, 0)
  const grandTotalReimb = (grandTotalMiles * perMileRate).toFixed(2)

  if (loading) return (
    <div style={{ paddingTop: 48, textAlign: 'center', color: 'var(--gray-400)', padding: 32 }}>
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
      {/* Summary bar */}
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
        const tripsByDate = [...group.trips].sort((a, b) =>
          sortDir === 'desc'
            ? b.date.localeCompare(a.date)
            : a.date.localeCompare(b.date)
        )

        return (
          <div key={group.userId} className="admin-user-group">
            <div
              className="admin-group-header"
              onClick={() => toggleExpand(group.userId)}
            >
              <div style={{ flex: 1 }}>
                <div className="admin-group-name">{group.userName}</div>
                <div className="admin-group-meta">
                  {group.trips.length} trip{group.trips.length !== 1 ? 's' : ''} · latest {group.latestDate}
                </div>
              </div>
              <div className="admin-group-totals">
                <div className="admin-group-miles">{group.totalMiles.toFixed(1)} mi</div>
                <div className="admin-group-reimb">${reimb}</div>
              </div>
              <span style={{ marginLeft: 10, color: 'var(--gray-400)', fontSize: 16 }}>
                {isOpen ? '▲' : '▼'}
              </span>
            </div>

            {isOpen && tripsByDate.map((trip) => {
              const tripReim = ((trip.miles || 0) * perMileRate).toFixed(2)
              const from = trip.startName || trip.startAddress || '?'
              const to = trip.endName || trip.endAddress || '?'
              return (
                <div key={trip.id} className="admin-trip-row">
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 11, color: 'var(--gray-400)', marginBottom: 2 }}>
                      {trip.date} · {formatTime(trip.startTime)} – {formatTime(trip.endTime)}
                    </div>
                    <div className="admin-trip-route">{from} → {to}</div>
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
