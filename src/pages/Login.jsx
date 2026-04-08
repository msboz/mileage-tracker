import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const ERROR_MESSAGES = {
  'auth/invalid-credential':       'Incorrect email or password.',
  'auth/user-not-found':           'No account found with that email.',
  'auth/wrong-password':           'Incorrect password.',
  'auth/email-already-in-use':     'An account with this email already exists.',
  'auth/weak-password':            'Password must be at least 6 characters.',
  'auth/invalid-email':            'Please enter a valid email address.',
  'auth/too-many-requests':        'Too many attempts. Try again later.',
  'auth/popup-closed-by-user':     'Sign-in cancelled.',
  'auth/network-request-failed':   'Network error. Check your connection.',
}

function friendlyError(err) {
  return ERROR_MESSAGES[err?.code] || err?.message || 'Something went wrong.'
}

export default function Login() {
  const { currentUser, signInWithGoogle, signInWithEmail, signUpWithEmail } = useAuth()
  const navigate = useNavigate()

  const [mode, setMode] = useState('signin') // 'signin' | 'signup'
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (currentUser) navigate('/', { replace: true })
  }, [currentUser, navigate])

  function switchMode(next) {
    setMode(next)
    setError('')
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      if (mode === 'signup') {
        await signUpWithEmail(email, password, name.trim())
      } else {
        await signInWithEmail(email, password)
      }
    } catch (err) {
      setError(friendlyError(err))
    } finally {
      setBusy(false)
    }
  }

  async function handleGoogle() {
    setError('')
    setBusy(true)
    try {
      await signInWithGoogle()
    } catch (err) {
      setError(friendlyError(err))
      setBusy(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-logo-wrap">
        <img src="/duplo-logo.png" alt="Duplo" className="login-logo" />
      </div>
      <p className="login-tagline">Mileage Tracker</p>

      <div className="login-card">
        {/* Mode tabs */}
        <div className="login-tabs">
          <button
            className={`login-tab${mode === 'signin' ? ' login-tab-active' : ''}`}
            onClick={() => switchMode('signin')}
            type="button"
          >
            Sign In
          </button>
          <button
            className={`login-tab${mode === 'signup' ? ' login-tab-active' : ''}`}
            onClick={() => switchMode('signup')}
            type="button"
          >
            Create Account
          </button>
        </div>

        {/* Email / password form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {mode === 'signup' && (
            <input
              className="input"
              type="text"
              placeholder="Full name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
              required
              disabled={busy}
            />
          )}
          <input
            className="input"
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
            disabled={busy}
          />
          <input
            className="input"
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
            required
            disabled={busy}
          />

          {error && (
            <div style={{ fontSize: 13, color: '#c0392b', textAlign: 'center' }}>{error}</div>
          )}

          <button className="btn-primary" type="submit" disabled={busy}>
            {busy ? '…' : mode === 'signup' ? 'Create Account' : 'Sign In'}
          </button>
        </form>

        {/* Divider */}
        <div className="login-divider">
          <span>or</span>
        </div>

        {/* Google */}
        <button className="btn-google" onClick={handleGoogle} disabled={busy} type="button">
          <svg width="20" height="20" viewBox="0 0 48 48">
            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
          </svg>
          Sign in with Google
        </button>
      </div>
    </div>
  )
}
