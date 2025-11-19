import React, { useState } from 'react'
import type { NextPage } from 'next'
import Head from 'next/head'
import AuthCard from '../components/AuthCard'
import FormInput from '../components/FormInput'
import { useRouter } from 'next/router'

const Register: NextPage = () => {
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [birthday, setBirthday] = useState('')
  const [role, setRole] = useState('dansator')
  const [cardNumber, setCardNumber] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!firstName.trim() || !lastName.trim() || !birthday || !email.trim() || !password) {
      setError('Toate câmpurile marcate sunt obligatorii')
      return
    }

    if (role === 'dansator' && !cardNumber.trim()) {
      setError('Numărul cardului este obligatoriu pentru dansatori')
      return
    }

    if (password !== confirmPassword) {
      setError('Parolele nu coincid')
      return
    }

    ;(async () => {
      try {
        const payload: any = {
          email,
          password,
          fullName: `${firstName} ${lastName}`,
          firstName,
          lastName,
          birthday,
          role,
          cardNumber,
        }

        const res = await fetch('/api/auth/signup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
        if (res.ok) {
          // redirect to login
          router.push('/login')
        } else {
          const data = await res.json()
          setError(data?.message || 'Eroare la înregistrare')
        }
      } catch (err) {
        setError('Eroare la înregistrare')
      }
    })()
  }

  return (
    <>
      <Head>
        <title>Înregistrare — FRDS Calendar</title>
      </Head>

  {/* imageLeft to place photo on the left */}
  <AuthCard title="Înregistrează-te" subtitle="Creează cont pentru a accesa platforma" imageLeft={true}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormInput label="Prenume" name="firstName" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
            <FormInput label="Nume" name="lastName" value={lastName} onChange={(e) => setLastName(e.target.value)} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="block text-sm font-medium text-gray-600">Data nașterii</label>
            <label className="block text-sm font-medium text-gray-600">Rol</label>
            <input type="date" value={birthday} onChange={(e) => setBirthday(e.target.value)} className="w-full px-4 py-3 rounded-lg border border-gray-200 bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400 shadow-sm" />
            <select value={role} onChange={(e) => setRole(e.target.value)} className="w-full px-4 py-3 rounded-lg border border-gray-200 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400 shadow-sm">
              <option value="dansator">Dansator</option>
              <option value="arbitru">Arbitru</option>
            </select>
          </div>

          {role === 'dansator' && (
            <FormInput label="Număr card" name="cardNumber" value={cardNumber} onChange={(e) => setCardNumber(e.target.value)} />
          )}

          <FormInput label="Email" name="email" type="email" placeholder="ex: nume@domeniu.ro" value={email} onChange={(e) => setEmail(e.target.value)} />

          <FormInput label="Parolă" name="password" type="password" placeholder="Alege o parolă" value={password} onChange={(e) => setPassword(e.target.value)} />

          <FormInput label="Confirmare parolă" name="confirmPassword" type="password" placeholder="Confirmă parola" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div>
            <button type="submit" className="w-full inline-flex items-center justify-center px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-lg text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-400">
              Creează cont
            </button>
          </div>
        </form>
      </AuthCard>
    </>
  )
}

export default Register
