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

  return (
    <div className="page">
      <header className="page-header">
        <button className="btn-back" onClick={() => navigate(-1)}>←</button>
        <h1>Settings</h1>
      </header>

      <div className="form">
        <label>Send log to email</label>
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
            {saved ? '✓ Saved' : saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>

      <div className="settings-footer">
        <p className="user-email">Signed in as {currentUser.email}</p>
        <button
          className="btn-secondary"
          style={{ width: 'auto', padding: '10px 24px' }}
          onClick={handleSignOut}
        >
          Sign Out
        </button>
      </div>
    </div>
  )
}
