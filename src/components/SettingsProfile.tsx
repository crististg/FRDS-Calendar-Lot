import React, { useEffect, useState } from 'react'
import { signOut } from 'next-auth/react'

type UserProfile = {
  firstName: string
  lastName: string
  birthday?: string // YYYY-MM-DD
  role?: string
  cardNumber?: string
  email: string
}

const STORAGE_KEY = 'frds_user'

export default function SettingsProfile() {
  const [profile, setProfile] = useState<UserProfile>({ firstName: '', lastName: '', birthday: '', role: '', cardNumber: '', email: '' })
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<UserProfile>(profile)

  useEffect(() => {
    let mounted = true

    async function load() {
      // Try to fetch from server API first (requires auth)
      try {
        const res = await fetch('/api/user/profile')
        if (res.ok) {
          const data = await res.json()
          const u = data.user || {}
          const p: UserProfile = {
            firstName: u.firstName || '',
            lastName: u.lastName || '',
            birthday: u.birthday ? new Date(u.birthday).toISOString().slice(0, 10) : '',
            role: u.role || '',
            cardNumber: u.cardNumber || '',
            email: u.email || '',
          }
          if (!mounted) return
          setProfile(p)
          setDraft(p)
          return
        }
      } catch (e) {
        // ignore fetch errors and fall back to localStorage/demo
      }

      // fallback: localStorage or demo values
      try {
        const raw = localStorage.getItem(STORAGE_KEY)
        if (raw) {
          const parsed = JSON.parse(raw)
          if (!mounted) return
          const p: UserProfile = {
            firstName: parsed.firstName || (parsed.fullName ? parsed.fullName.split(' ')[0] : '') || '',
            lastName: parsed.lastName || (parsed.fullName ? parsed.fullName.split(' ').slice(1).join(' ') : '') || '',
            birthday: parsed.birthday || '',
            role: parsed.role || '',
            cardNumber: parsed.cardNumber || '',
            email: parsed.email || '',
          }
          setProfile(p)
          setDraft(p)
        } else {
          const demo = { firstName: 'Utilizator', lastName: 'Demo', birthday: '', role: 'dansator', cardNumber: '', email: 'demo@example.com' }
          if (!mounted) return
          setProfile(demo)
          setDraft(demo)
        }
      } catch (e) {
        // ignore
      }
    }

    load()
    return () => { mounted = false }
  }, [])

  function startEdit() {
    setDraft(profile)
    setEditing(true)
  }

  function cancelEdit() {
    setDraft(profile)
    setEditing(false)
  }

  function save() {
    setProfile(draft)
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(draft))
    } catch (e) {
      // ignore
    }
    setEditing(false)
    console.log('Saved profile', draft)
  }

  function handleLogout() {
    // signOut will redirect to the login page after clearing session
    signOut({ callbackUrl: '/login' })
  }

  return (
    <section>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold">Profil</h3>
        {!editing ? (
          <div className="flex items-center gap-2">
            <button onClick={startEdit} className="text-sm px-3 py-1 rounded-md bg-blue-600 text-white">Editează</button>
            <button onClick={handleLogout} className="text-sm px-3 py-1 rounded-md bg-red-600 text-white">Deconectare</button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <button onClick={cancelEdit} className="text-sm px-3 py-1 rounded-md bg-gray-100">Anulează</button>
            <button onClick={save} className="text-sm px-3 py-1 rounded-md bg-blue-600 text-white">Salvează</button>
          </div>
        )}
      </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Prenume</label>
              <input
                value={editing ? draft.firstName : profile.firstName}
                onChange={(e) => setDraft((s) => ({ ...s, firstName: e.target.value }))}
                disabled={!editing}
                className={`w-full mt-1 px-3 py-2 border rounded-md ${editing ? 'border-gray-300' : 'border-transparent bg-gray-50'}`}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Nume</label>
              <input
                value={editing ? draft.lastName : profile.lastName}
                onChange={(e) => setDraft((s) => ({ ...s, lastName: e.target.value }))}
                disabled={!editing}
                className={`w-full mt-1 px-3 py-2 border rounded-md ${editing ? 'border-gray-300' : 'border-transparent bg-gray-50'}`}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Data nașterii</label>
              <input
                type="date"
                value={editing ? draft.birthday || '' : profile.birthday || ''}
                onChange={(e) => setDraft((s) => ({ ...s, birthday: e.target.value }))}
                disabled={!editing}
                className={`w-full mt-1 px-3 py-2 border rounded-md ${editing ? 'border-gray-300' : 'border-transparent bg-gray-50'}`}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Email</label>
              <input
                value={editing ? draft.email : profile.email}
                onChange={(e) => setDraft((s) => ({ ...s, email: e.target.value }))}
                disabled={!editing}
                className={`w-full mt-1 px-3 py-2 border rounded-md ${editing ? 'border-gray-300' : 'border-transparent bg-gray-50'}`}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Rol</label>
            <input
              value={profile.role || ''}
              disabled
              readOnly
              className={`w-full mt-1 px-3 py-2 border rounded-md border-transparent bg-gray-50 text-gray-700`}
            />
            </div>

            { (editing ? draft.role : profile.role)?.toLowerCase() === 'dansator' && (
              <div>
                <label className="block text-sm font-medium text-gray-700">Număr card</label>
                <input
                  value={editing ? draft.cardNumber || '' : profile.cardNumber || ''}
                  onChange={(e) => setDraft((s) => ({ ...s, cardNumber: e.target.value }))}
                  disabled={!editing}
                  className={`w-full mt-1 px-3 py-2 border rounded-md ${editing ? 'border-gray-300' : 'border-transparent bg-gray-50'}`}
                />
              </div>
            )}
          </div>

      <div className="mt-6">
        <h4 className="text-md font-semibold mb-2">Informații</h4>
        <p className="text-sm text-gray-600">Poți modifica detaliile tale personale. Datele sunt salvate local pentru demo; autentificarea va afișa profilul din baza de date când e disponibil.</p>
      </div>
    </section>
  )
}
