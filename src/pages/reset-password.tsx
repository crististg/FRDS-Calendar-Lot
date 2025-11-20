import React, { useState, useEffect } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import type { NextPage } from 'next'

const Reset: NextPage = () => {
  const router = useRouter()
  const { token } = router.query
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [status, setStatus] = useState<'idle' | 'submitting' | 'done' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!token) return
  }, [token])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
  const tok = Array.isArray(token) ? token[0] : token
  if (!tok) return setError('Token lipsă')
    if (password.length < 7) return setError('Parola trebuie să aibă cel puțin 7 caractere')
    if (password !== confirm) return setError('Parolele nu coincid')
    setStatus('submitting')
    try {
  const res = await fetch('/api/auth/reset', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: String(tok), password }) })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        setError(d.error || 'Eroare la resetare')
        setStatus('error')
        return
      }
      setStatus('done')
      // redirect to login after a short delay so user can read the success message
      setTimeout(() => {
        router.push('/login')
      }, 1400)
    } catch (err) {
      console.error(err)
      setError('Eroare de rețea')
      setStatus('error')
    }
  }

  return (
    <>
      <Head>
        <title>Resetare parolă — FRDS</title>
      </Head>
      <div className="min-h-screen flex items-center justify-center py-12 px-4">
        <div className="max-w-md w-full bg-white p-6 rounded-lg shadow">
          <h2 className="text-lg font-semibold mb-2">Resetare parolă</h2>
          {!token ? (
            <div className="text-sm text-gray-500">Link invalid sau token lipsă.</div>
          ) : status === 'done' ? (
            <div className="text-sm text-green-600">Parola a fost resetată. Poți să te autentifici.</div>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              <label className="block text-sm">Parola nouă</label>
              <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" className="w-full px-3 py-2 border rounded" />
              <label className="block text-sm">Confirmă parola</label>
              <input value={confirm} onChange={(e) => setConfirm(e.target.value)} type="password" className="w-full px-3 py-2 border rounded" />
              {error && <div className="text-sm text-red-600">{error}</div>}
              <div className="flex justify-end">
                <button type="submit" disabled={status === 'submitting'} className="px-4 py-2 bg-blue-600 text-white rounded">Setează parola</button>
              </div>
            </form>
          )}
        </div>
      </div>
    </>
  )
}

export default Reset
