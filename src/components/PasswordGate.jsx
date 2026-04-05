import { useEffect, useState } from 'react'
import { getGlobalSettings, verifyPassword } from '../services/globalSettings'

export default function PasswordGate({ sessionKey, title, description, children }) {
  const [unlocked, setUnlocked] = useState(
    () => sessionStorage.getItem(sessionKey) === 'true'
  )
  const [input, setInput] = useState('')
  const [error, setError] = useState(false)
  const [checking, setChecking] = useState(false)
  const [passwordHash, setPasswordHash] = useState(null)
  const [loadingHash, setLoadingHash] = useState(true)

  useEffect(() => {
    if (unlocked) return
    getGlobalSettings()
      .then((s) => setPasswordHash(s.adminPasswordHash || ''))
      .catch(() => setPasswordHash(''))
      .finally(() => setLoadingHash(false))
  }, [unlocked])

  if (unlocked) return children

  async function handleSubmit(e) {
    e.preventDefault()
    setChecking(true)
    const ok = await verifyPassword(input, passwordHash)
    setChecking(false)
    if (ok) {
      sessionStorage.setItem(sessionKey, 'true')
      setUnlocked(true)
    } else {
      setError(true)
      setInput('')
    }
  }

  return (
    <div className="pw-gate">
      <span style={{ fontSize: 36 }}>🔒</span>
      <div className="pw-gate-title">{title}</div>
      {description && (
        <p style={{ fontSize: 13, color: 'var(--gray-600)', textAlign: 'center' }}>
          {description}
        </p>
      )}
      <form
        onSubmit={handleSubmit}
        style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 10 }}
      >
        <input
          type="password"
          className="input"
          placeholder="Password"
          value={input}
          onChange={(e) => { setInput(e.target.value); setError(false) }}
          autoFocus
          disabled={loadingHash || checking}
        />
        {error && <span className="pw-gate-error">Incorrect password. Try again.</span>}
        <button type="submit" className="btn-primary" disabled={loadingHash || checking}>
          {checking ? 'Checking…' : loadingHash ? 'Loading…' : 'Unlock'}
        </button>
      </form>
    </div>
  )
}
