import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import PasswordGate from '../components/PasswordGate'
import { getGlobalSettings, saveGlobalSettings, hashPassword, verifyPassword } from '../services/globalSettings'

function GlobalSettingsForm() {
  const [recipientEmail, setRecipientEmail] = useState('')
  const [perMileRate, setPerMileRate] = useState('0.67')
  const [adminEmailsText, setAdminEmailsText] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  // Password change state
  const [currentPw, setCurrentPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [pwSaving, setPwSaving] = useState(false)
  const [pwError, setPwError] = useState('')
  const [pwSaved, setPwSaved] = useState(false)
  const [storedHash, setStoredHash] = useState('')

  useEffect(() => {
    getGlobalSettings()
      .then((s) => {
        setRecipientEmail(s.recipientEmail || '')
        setPerMileRate(String(s.perMileRate ?? 0.67))
        setAdminEmailsText((s.adminEmails || []).join('\n'))
        setStoredHash(s.adminPasswordHash || '')
      })
      .catch((err) => console.error('GlobalSettings load error:', err))
      .finally(() => setLoading(false))
  }, [])

  async function handleSave() {
    setSaving(true)
    const adminEmails = adminEmailsText
      .split('\n')
      .map((e) => e.trim())
      .filter(Boolean)
    await saveGlobalSettings({
      recipientEmail: recipientEmail.trim(),
      perMileRate: parseFloat(perMileRate) || 0.67,
      adminEmails,
    })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  async function handleChangePassword() {
    setPwError('')
    if (!newPw) { setPwError('New password cannot be empty.'); return }
    if (newPw !== confirmPw) { setPwError('New passwords do not match.'); return }
    if (newPw.length < 6) { setPwError('Password must be at least 6 characters.'); return }

    setPwSaving(true)
    const currentOk = await verifyPassword(currentPw, storedHash)
    if (!currentOk) {
      setPwError('Current password is incorrect.')
      setPwSaving(false)
      return
    }
    const newHash = await hashPassword(newPw)
    await saveGlobalSettings({ adminPasswordHash: newHash })
    setStoredHash(newHash)
    // Clear the session so any new login uses the new password
    sessionStorage.removeItem('globalSettingsUnlocked')
    sessionStorage.removeItem('adminUnlocked')
    setCurrentPw('')
    setNewPw('')
    setConfirmPw('')
    setPwSaving(false)
    setPwSaved(true)
    setTimeout(() => setPwSaved(false), 3000)
  }

  if (loading) return (
    <div style={{ paddingTop: 40, textAlign: 'center', color: 'var(--gray-400)' }}>
      Loading…
    </div>
  )

  return (
    <div className="page-content">
      {/* ── General settings ── */}
      <div className="form">
        <label>Mileage Report Recipient Email</label>
        <input
          type="email"
          inputMode="email"
          className="input"
          value={recipientEmail}
          onChange={(e) => setRecipientEmail(e.target.value)}
          placeholder="mileage@duplo.com"
        />

        <label>Per-Mile Reimbursement Rate ($)</label>
        <input
          type="number"
          inputMode="decimal"
          step="0.01"
          min="0"
          className="input"
          value={perMileRate}
          onChange={(e) => setPerMileRate(e.target.value)}
          placeholder="0.67"
        />
        <span style={{ fontSize: 12, color: 'var(--gray-400)', marginTop: 2 }}>
          IRS standard rate is $0.67/mile for 2024
        </span>

        <label>Admin Emails — can view all logs (one per line)</label>
        <textarea
          className="input"
          rows={5}
          value={adminEmailsText}
          onChange={(e) => setAdminEmailsText(e.target.value)}
          placeholder={'admin@duplo.com\nmanager@duplo.com'}
          style={{ resize: 'vertical', fontFamily: 'monospace', fontSize: 14, lineHeight: 1.6 }}
        />
        <span style={{ fontSize: 12, color: 'var(--gray-400)', marginTop: 2 }}>
          These Google accounts can access the Admin Dashboard
        </span>

        <div style={{ paddingTop: 16 }}>
          <button className="btn-primary" onClick={handleSave} disabled={saving}>
            {saved ? '✓ Saved' : saving ? 'Saving…' : 'Save Global Settings'}
          </button>
        </div>
      </div>

      {/* ── Change password ── */}
      <p className="section-label" style={{ marginTop: 24 }}>Change Admin Password</p>
      <div className="form">
        <label>Current Password</label>
        <input
          type="password"
          className="input"
          placeholder="Current password"
          value={currentPw}
          onChange={(e) => { setCurrentPw(e.target.value); setPwError('') }}
        />
        <label>New Password</label>
        <input
          type="password"
          className="input"
          placeholder="New password (min 6 characters)"
          value={newPw}
          onChange={(e) => { setNewPw(e.target.value); setPwError('') }}
        />
        <label>Confirm New Password</label>
        <input
          type="password"
          className="input"
          placeholder="Repeat new password"
          value={confirmPw}
          onChange={(e) => { setConfirmPw(e.target.value); setPwError('') }}
        />
        {pwError && (
          <span style={{ fontSize: 13, color: '#c0392b', fontWeight: 600 }}>{pwError}</span>
        )}
        {pwSaved && (
          <span style={{ fontSize: 13, color: 'var(--success)', fontWeight: 600 }}>
            ✓ Password changed. You will need to re-enter it next time.
          </span>
        )}
        <div style={{ paddingTop: 8, paddingBottom: 24 }}>
          <button
            className="btn-secondary"
            onClick={handleChangePassword}
            disabled={pwSaving || !currentPw || !newPw || !confirmPw}
          >
            {pwSaving ? 'Saving…' : 'Change Password'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function GlobalSettings() {
  const navigate = useNavigate()

  return (
    <div className="page">
      <nav className="top-bar">
        <button className="btn-back-nav" onClick={() => navigate(-1)}>←</button>
        <img src="/duplo-logo.png" alt="Duplo" className="top-bar-logo" />
        <span className="top-bar-title">Global Settings</span>
      </nav>
      <PasswordGate
        sessionKey="globalSettingsUnlocked"
        title="Admin Area"
        description="Enter the admin password to manage global settings."
      >
        <GlobalSettingsForm />
      </PasswordGate>
    </div>
  )
}
