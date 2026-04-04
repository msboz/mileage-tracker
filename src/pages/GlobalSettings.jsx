import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import PasswordGate from '../components/PasswordGate'
import { getGlobalSettings, saveGlobalSettings } from '../services/globalSettings'

function GlobalSettingsForm() {
  const [recipientEmail, setRecipientEmail] = useState('')
  const [perMileRate, setPerMileRate] = useState('0.67')
  const [adminEmailsText, setAdminEmailsText] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    getGlobalSettings().then((s) => {
      setRecipientEmail(s.recipientEmail || '')
      setPerMileRate(String(s.perMileRate ?? 0.67))
      setAdminEmailsText((s.adminEmails || []).join('\n'))
      setLoading(false)
    })
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

  if (loading) return (
    <div style={{ paddingTop: 40, textAlign: 'center', color: 'var(--gray-400)' }}>
      Loading…
    </div>
  )

  return (
    <div className="page-content">
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
