import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const { currentUser, signInWithGoogle } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (currentUser) navigate('/', { replace: true })
  }, [currentUser, navigate])

  return (
    <div className="login-page">
      <h1>Mileage Tracker</h1>
      <p className="subtitle">Track your customer visits</p>
      <button className="btn-google" onClick={signInWithGoogle}>
        Sign in with Google
      </button>
    </div>
  )
}
