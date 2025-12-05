import React, { useState } from 'react'
import type { NextPage } from 'next'
import Head from 'next/head'
import AuthCard from '../components/AuthCard'
import FormInput from '../components/FormInput'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/router'

const Login: NextPage = () => {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

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
        // successful login
        router.push('/app')
      }
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
    </>
  )
}

export default Login
