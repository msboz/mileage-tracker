import { createContext, useContext, useEffect, useState } from 'react'
import {
  GoogleAuthProvider, signInWithRedirect, getRedirectResult,
  signOut as fbSignOut, onAuthStateChanged,
} from 'firebase/auth'
import { doc, setDoc, getDoc } from 'firebase/firestore'
import { auth, db } from '../firebase'

const AuthContext = createContext(null)

async function ensureUserDoc(user) {
  const userRef = doc(db, 'users', user.uid)
  const snap = await getDoc(userRef)
  if (!snap.exists()) {
    await setDoc(userRef, {
      email: user.email,
      displayName: user.displayName,
      recipientEmail: '',
    })
  }
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(undefined) // undefined = still loading

  useEffect(() => {
    // Handle the redirect result when returning from Google sign-in
    getRedirectResult(auth).then(async (result) => {
      if (result?.user) {
        await ensureUserDoc(result.user)
      }
    }).catch((err) => {
      console.error('Redirect sign-in error:', err.message)
    })

    return onAuthStateChanged(auth, async (user) => {
      if (user) {
        await ensureUserDoc(user)
      }
      setCurrentUser(user)
    })
  }, [])

  async function signInWithGoogle() {
    const provider = new GoogleAuthProvider()
    await signInWithRedirect(auth, provider)
  }

  async function signOut() {
    await fbSignOut(auth)
  }

  return (
    <AuthContext.Provider value={{ currentUser, signInWithGoogle, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
