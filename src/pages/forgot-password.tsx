import React, { useState } from 'react'
import Head from 'next/head'
import type { NextPage } from 'next'

const Forgot: NextPage = () => {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setStatus('sending')
    try {
      const res = await fetch('/api/auth/forgot', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        setError(d.error || 'Eroare server')
        setStatus('error')
        return
      }
      setStatus('sent')
    } catch (err) {
      console.error(err)
      setError('Eroare de rețea')
      setStatus('error')
    }
  }

  return (
    <>
      <Head>
        <title>Recuperare parolă — FRDS</title>
      </Head>
      <div className="min-h-screen flex items-center justify-center py-12 px-4">
        <div className="max-w-md w-full bg-white p-6 rounded-lg shadow">
          <h2 className="text-lg font-semibold mb-2">Recuperare parolă</h2>
          <p className="text-sm text-gray-500 mb-4">Introdu emailul asociat contului și vei primi un link pentru resetare.</p>

          {status === 'sent' ? (
            <div className="text-sm text-green-600">Dacă există un cont pentru acest email, vei primi un link pentru resetare.</div>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              <label className="block text-sm">Email</label>
              <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" className="w-full px-3 py-2 border rounded" />
              {error && <div className="text-sm text-red-600">{error}</div>}
              <div className="flex justify-end">
                <button type="submit" disabled={status === 'sending'} className="px-4 py-2 bg-blue-600 text-white rounded">Trimite</button>
              </div>
            </form>
          )}
        </div>
      </div>
    </>
  )
}

export default Forgot
