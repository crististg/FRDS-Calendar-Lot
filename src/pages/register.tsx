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
  const [role, setRole] = useState('club')
  const [clubName, setClubName] = useState('')
  const [clubCity, setClubCity] = useState('')
  const [contactPerson, setContactPerson] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (role === 'club') {
      if (!clubName.trim() || !contactPerson.trim() || !phone.trim() || !email.trim() || !password) {
        setError('Toate câmpurile marcate sunt obligatorii pentru club')
        return
      }
    } else {
      if (!firstName.trim() || !lastName.trim() || !birthday || !email.trim() || !password) {
        setError('Toate câmpurile marcate sunt obligatorii')
        return
      }
    }

    if (password !== confirmPassword) {
      setError('Parolele nu coincid')
      return
    }

    ;(async () => {
      try {
        const payload: any = { email, password, role }
        if (role === 'club') {
          payload.clubName = clubName
          payload.clubCity = clubCity || null
          payload.contactPerson = contactPerson
          payload.phone = phone
          // also set fullName as contact person for compatibility
          payload.fullName = contactPerson
        } else {
          payload.firstName = firstName
          payload.lastName = lastName
          payload.birthday = birthday
          payload.fullName = `${firstName} ${lastName}`
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
          {role === 'club' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormInput label="Nume Club" name="clubName" value={clubName} onChange={(e) => setClubName(e.target.value)} placeholder="Ex: Clubul de Dans X" />
              <FormInput label="Persoană de contact" name="contactPerson" value={contactPerson} onChange={(e) => setContactPerson(e.target.value)} placeholder="Nume persoană de contact" />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormInput label="Prenume" name="firstName" value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Prenume" />
              <FormInput label="Nume" name="lastName" value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Nume" />
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {role === 'club' ? (
              <>
                <FormInput label="Oraș club" name="clubCity" value={clubCity} onChange={(e) => setClubCity(e.target.value)} placeholder="Ex: București" />
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-2">Rol</label>
                  <select value={role} onChange={(e) => setRole(e.target.value)} className="w-full px-4 py-3 rounded-lg border border-gray-200 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400 shadow-sm">
                    <option value="club">Club</option>
                    <option value="arbitru">Arbitru</option>
                  </select>
                </div>
              </>
            ) : (
              <>
                <FormInput label="Data nașterii" name="birthday" type="date" value={birthday} onChange={(e) => setBirthday(e.target.value)} />
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-2">Rol</label>
                  <select value={role} onChange={(e) => setRole(e.target.value)} className="w-full px-4 py-3 rounded-lg border border-gray-200 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400 shadow-sm">
                    <option value="club">Club</option>
                    <option value="arbitru">Arbitru</option>
                  </select>
                </div>
              </>
            )}
          </div>

          {role === 'club' && (
            <FormInput label="Telefon" name="phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Ex: +40 712 345 678" />
          )}

          {/* Clubs will add dancers later — no card number required at signup */}

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
