import { useState } from 'react'

const CORRECT_PASSWORD = 'Duplo123'

export default function PasswordGate({ sessionKey, title, description, children }) {
  const [unlocked, setUnlocked] = useState(
    () => sessionStorage.getItem(sessionKey) === 'true'
  )
  const [input, setInput] = useState('')
  const [error, setError] = useState(false)

  if (unlocked) return children

  function handleSubmit(e) {
    e.preventDefault()
    if (input === CORRECT_PASSWORD) {
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
        />
        {error && <span className="pw-gate-error">Incorrect password. Try again.</span>}
        <button type="submit" className="btn-primary">Unlock</button>
      </form>
    </div>
  )
}
