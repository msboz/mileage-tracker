import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function ProtectedRoute({ children }) {
  const { currentUser } = useAuth()
  if (currentUser === undefined) return (
    <div className="loading">
      <img src="/duplo-logo.png" alt="Duplo" className="loading-logo" />
      <span className="loading-text">Loading…</span>
    </div>
  )
  if (!currentUser) return <Navigate to="/login" replace />
  return children
}
