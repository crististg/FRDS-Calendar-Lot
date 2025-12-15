import React, { useState, useEffect } from 'react'
import type { NextPage } from 'next'
import Head from 'next/head'
import AuthCard from '../components/AuthCard'
import FormInput from '../components/FormInput'
import { signIn, useSession } from 'next-auth/react'
import { useRouter } from 'next/router'
import Icon from '../components/Icon'

const Login: NextPage = () => {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showApprovalPending, setShowApprovalPending] = useState(false)
  const [justLoggedIn, setJustLoggedIn] = useState(false)
  const router = useRouter()
  const { data: session } = useSession()

  useEffect(() => {
    // Only check approval status if we just logged in (not on page reload)
    if (session && justLoggedIn) {
      // Check if user is approved
      const user = (session as any).user
      if (user?.isApproved === false) {
        // User not approved, show modal
        setShowApprovalPending(true)
        setJustLoggedIn(false)
      } else {
        // User is approved or field not set, redirect to app
        router.push('/app')
      }
    }
  }, [session, justLoggedIn, router])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!email.trim() || !password) {
      setError('Both Email and password are required')
      return
    }

    ;(async () => {
      const res = await signIn('credentials', { redirect: false, email, password })
      // signIn returns either an error or ok
      if (res && (res as any).error) {
        setError((res as any).error || 'Autentificare eșuată')
      } else {
        // Mark that we just logged in, so the useEffect knows to check approval status
        setJustLoggedIn(true)
      }
      // If signIn is successful, the session will update and the useEffect will handle the rest
    })()
  }

  return (
    <>
      <Head>
        <title>Autentificare — FRDS Calendar</title>
      </Head>

      <AuthCard title="Bine ai revenit" subtitle="Echipa națională și administratori — platformă internă FRDS">
        <form onSubmit={handleSubmit} className="space-y-4">
          <FormInput label="Email" name="email" type="email" placeholder="ex: nume@domeniu.ro" value={email} onChange={(e) => setEmail(e.target.value)} />

          <FormInput label="Parolă" name="password" type="password" placeholder="Parola ta" value={password} onChange={(e) => setPassword(e.target.value)} />

          <div className="flex items-center justify-between text-sm">
            <label className="inline-flex items-center gap-2 text-gray-600">
              <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
              <span>Ține-mă minte</span>
            </label>

            <a href="/forgot-password" className="text-blue-600 hover:underline">
              Ai uitat parola?
            </a>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div>
            <button type="submit" className="w-full inline-flex items-center justify-center px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-lg text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-400">
                Conectare
            </button>
          </div>

          <div>
            <button type="button" onClick={() => { document.cookie = 'guest=1; path=/; max-age=86400'; router.push('/app?guest=1') }} className="w-full mt-2 inline-flex items-center justify-center px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-lg text-sm font-semibold">
              Intră ca vizitator
            </button>
          </div>

          <p className="mt-4 text-xs text-gray-500 text-center">Nu ai un cont? <a href="/register" className="text-blue-600 font-medium">Înregistrează-te</a></p>
        </form>
      </AuthCard>

      {/* Approval Pending Modal */}
      {showApprovalPending && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-lg p-8 max-w-sm w-full text-center">
            <div className="mb-6">
              <div className="inline-block p-3 bg-yellow-100 rounded-full">
                <Icon name="clock" className="h-8 w-8 text-yellow-600" />
              </div>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-3">Aprobarea în așteptare</h2>
            <p className="text-gray-600 mb-6">
              Contul dvs. este în așteptarea aprobării administratorului. Vă contactăm în curând cu mai multe informații.
            </p>
            <button
              onClick={() => setShowApprovalPending(false)}
              className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition"
            >
              Înțeles
            </button>
          </div>
        </div>
      )}
    </>
  )
}

export default Login
