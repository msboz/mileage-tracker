import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Settings() {
  const { currentUser, signOut } = useAuth()
  const navigate = useNavigate()

  async function handleSignOut() {
    await signOut()
    navigate('/login', { replace: true })
  }

  const initials = (currentUser.displayName || currentUser.email || '?')
    .charAt(0).toUpperCase()

  return (
    <div className="page">
      <nav className="top-bar">
        <button className="btn-back-nav" onClick={() => navigate(-1)}>←</button>
        <img src="/duplo-logo.png" alt="Duplo" className="top-bar-logo" />
        <span className="top-bar-title">Settings</span>
      </nav>

      <div className="page-content">
        <div className="settings-user-card">
          <div className="user-avatar">{initials}</div>
          <div>
            {currentUser.displayName && (
              <div className="user-name">{currentUser.displayName}</div>
            )}
            <div className="user-email">{currentUser.email}</div>
          </div>
        </div>

        <p className="section-label">Administration</p>
        <button
          className="btn-secondary"
          onClick={() => navigate('/global-settings')}
          style={{ marginBottom: 10 }}
        >
          ⚙️ Global Settings
        </button>
        <button
          className="btn-secondary"
          onClick={() => navigate('/admin')}
        >
          📋 Admin Dashboard
        </button>

        <div className="settings-footer">
          <button className="btn-secondary" onClick={handleSignOut}>
            Sign Out
          </button>
        </div>
      </div>
    </div>
  )
}
