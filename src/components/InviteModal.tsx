import React, { useEffect, useState } from 'react'

type UserRow = {
  _id?: string
  firstName?: string
  lastName?: string
  fullName?: string
  email: string
  role?: string
}

type Props = {
  open: boolean
  eventId: string | null
  onClose: () => void
  onInvited?: (email: string) => void
}

export default function InviteModal({ open, eventId, onClose, onInvited }: Props) {
  const [query, setQuery] = useState('')
  const [users, setUsers] = useState<UserRow[]>([])
  const [loading, setLoading] = useState(false)
  const [statusMap, setStatusMap] = useState<Record<string, 'idle' | 'sending' | 'sent' | 'error'>>({})

  useEffect(() => {
    if (!open) return
    let cancelled = false
    const fetchUsers = async () => {
      setLoading(true)
      try {
        const url = '/api/users' + (query ? `?q=${encodeURIComponent(query)}` : '')
        const res = await fetch(url)
        if (!res.ok) {
          setUsers([])
          return
        }
        const data = await res.json()
        if (cancelled) return

        let fetched = data.users || []

        // If eventId provided, fetch event attendees and exclude them from the list
        if (eventId) {
          try {
            const evRes = await fetch(`/api/events/${eventId}`)
            if (evRes.ok) {
              const evData = await evRes.json()
              const attendees = (evData?.event?.attendees || [])
              const attendeeEmails = new Set(attendees.map((a: any) => String(a.email || '').toLowerCase()))
              const attendeeIds = new Set(attendees.map((a: any) => String(a._id || a)))
              fetched = fetched.filter((u: any) => {
                const email = String(u.email || '').toLowerCase()
                const id = String(u._id || '')
                return !attendeeEmails.has(email) && !attendeeIds.has(id)
              })
            }
          } catch (err) {
            console.error('Failed to load event attendees', err)
          }
        }

        setUsers(fetched)
      } catch (err) {
        console.error('Failed to load users', err)
        setUsers([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    // small debounce
    const t = setTimeout(fetchUsers, 250)
    return () => { cancelled = true; clearTimeout(t) }
  }, [open, query])

  if (!open) return null

  const inviteUser = async (u: UserRow) => {
    if (!eventId) return
    setStatusMap((s) => ({ ...s, [u.email]: 'sending' }))
    try {
      const payload: any = {}
      // prefer sending userIds so server uses the canonical email from DB
      if (u._id) payload.userIds = [u._id]
      else payload.emails = [u.email]

      const res = await fetch(`/api/events/${eventId}/invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        console.error('Invite failed', data)
        setStatusMap((s) => ({ ...s, [u.email]: 'error' }))
        return
      }
      // remove user from list for this event once invited
      setUsers((prev) => prev.filter((x) => String(x.email || '').toLowerCase() !== String(u.email || '').toLowerCase()))
      setStatusMap((s) => {
        const next = { ...s }
        delete next[u.email]
        return next
      })
      onInvited?.(u.email)
    } catch (err) {
      console.error('Invite error', err)
      setStatusMap((s) => ({ ...s, [u.email]: 'error' }))
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-2xl bg-white rounded-xl shadow-2xl p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold">Invită participanți</h3>
            <p className="text-sm text-gray-500">Caută în lista de utilizatori și trimite invitații individual</p>
          </div>
          <div className="text-sm text-gray-500">Eveniment: {eventId || '-'}</div>
        </div>

        <div className="mt-4">
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Caută după nume sau email" className="w-full px-3 py-2 border rounded-md bg-gray-50" />
        </div>

        <div className="mt-4 max-h-60 overflow-auto">
          {loading ? (
            <div className="text-sm text-gray-500">Se încarcă...</div>
          ) : users.length === 0 ? (
            <div className="text-sm text-gray-500">Niciun utilizator găsit.</div>
          ) : (
            <div className="space-y-2">
              {users.map((u) => {
                const id = u.email || u._id || ''
                const status = statusMap[u.email] || 'idle'
                const name = [u.firstName, u.lastName].filter(Boolean).join(' ') || u.fullName || u.email
                return (
                  <div key={id} className="flex items-center justify-between gap-4 p-2 rounded-md hover:bg-gray-50">
                    <div>
                      <div className="text-sm font-medium">{name}</div>
                      <div className="text-xs text-gray-500">{u.email} {u.role ? `· ${u.role}` : ''}</div>
                    </div>
                    <div>
                      {status === 'sent' ? (
                        <span className="text-xs text-green-600">Trimis</span>
                      ) : status === 'sending' ? (
                        <button className="px-3 py-1 text-sm bg-gray-200 rounded" disabled>Se trimite…</button>
                      ) : (
                        <button onClick={() => inviteUser(u)} className="px-3 py-1 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded">Invită</button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 mt-4">
          <button onClick={onClose} className="px-4 py-2 text-sm rounded-md hover:bg-gray-100">Închide</button>
        </div>
      </div>
    </div>
  )
}
