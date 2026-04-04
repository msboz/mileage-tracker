import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { useAuth } from '../context/AuthContext'
import { db } from '../firebase'

export default function Settings() {
  const { currentUser, signOut } = useAuth()
  const navigate = useNavigate()
  const [recipientEmail, setRecipientEmail] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    async function load() {
      const snap = await getDoc(doc(db, 'users', currentUser.uid))
      if (snap.exists()) setRecipientEmail(snap.data().recipientEmail || '')
    }
    load()
  }, [currentUser.uid])

  async function handleSave() {
    setSaving(true)
    await setDoc(doc(db, 'users', currentUser.uid), { recipientEmail }, { merge: true })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

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

        <p className="section-label">Email Report</p>
        <div className="form">
          <label>Send daily log to</label>
          <input
            type="email"
            inputMode="email"
            value={recipientEmail}
            onChange={(e) => setRecipientEmail(e.target.value)}
            placeholder="reports@example.com"
            className="input"
          />
          <div style={{ paddingTop: 16 }}>
            <button className="btn-primary" onClick={handleSave} disabled={saving}>
              {saved ? '✓ Saved' : saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>

        <div className="settings-footer">
          <button className="btn-secondary" onClick={handleSignOut}>
            Sign Out
          </button>
        </div>
      </div>
    </div>
  )
}
