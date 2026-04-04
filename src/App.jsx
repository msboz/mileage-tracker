import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import Login from './pages/Login'
import TodayLog from './pages/TodayLog'
import StartTrip from './pages/StartTrip'
import TripInProgress from './pages/TripInProgress'
import EndTrip from './pages/EndTrip'
import Settings from './pages/Settings'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<ProtectedRoute><TodayLog /></ProtectedRoute>} />
          <Route path="/start" element={<ProtectedRoute><StartTrip /></ProtectedRoute>} />
          <Route path="/in-progress" element={<ProtectedRoute><TripInProgress /></ProtectedRoute>} />
          <Route path="/end" element={<ProtectedRoute><EndTrip /></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
