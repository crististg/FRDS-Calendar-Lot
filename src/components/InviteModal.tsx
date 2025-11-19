import React, { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import Icon from './Icon'

type UserSummary = {
  _id: string
  firstName?: string
  lastName?: string
  fullName?: string
  email?: string
}

type Props = {
  open: boolean
  eventId: string | null
  currentAttendees?: Array<string | { _id?: string }>
  onClose: () => void
  onInvited?: (invitedIds: string[]) => void
}

export default function InviteModal({ open, eventId, currentAttendees = [], onClose, onInvited }: Props) {
  const { data: session } = useSession()
  const meId = (session as any)?.user?.id

  const [q, setQ] = useState('')
  const [users, setUsers] = useState<UserSummary[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [invitingIds, setInvitingIds] = useState<Record<string, boolean>>({})

  // normalize attendees ids
  const attendeeIds = (currentAttendees || []).map((a: any) => (typeof a === 'string' ? a : (a._id || a.id))).filter(Boolean)

  useEffect(() => {
    if (!open) return
    let mounted = true
    const fetchUsers = async () => {
      setLoading(true)
      setError(null)
      try {
        const url = `/api/users?q=${encodeURIComponent(q || '')}&limit=200`
        const res = await fetch(url)
        if (!mounted) return
        if (!res.ok) {
          setError('Nu am putut încărca utilizatorii')
          setUsers([])
        } else {
          const data = await res.json()
          const list: UserSummary[] = Array.isArray(data.users) ? data.users : data.users || []
          // filter out attendees and self
          const filtered = list.filter((u) => String(u._id) !== String(meId) && !attendeeIds.includes(String(u._id)))
          setUsers(filtered)
        }
      } catch (err) {
        console.error('[InviteModal] fetch users failed', err)
        setError('Eroare server')
        setUsers([])
      } finally {
        if (mounted) setLoading(false)
      }
    }

    fetchUsers()
    return () => { mounted = false }
  }, [open, q, eventId])

  const inviteMany = async (ids: string[]) => {
    if (!eventId) return
    const toInvite = ids.filter(Boolean)
    if (toInvite.length === 0) return
    // mark inviting
    const next: Record<string, boolean> = { ...invitingIds }
    toInvite.forEach((id) => { next[id] = true })
    setInvitingIds(next)
    try {
      const res = await fetch(`/api/events/${encodeURIComponent(eventId)}/invite`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userIds: toInvite })
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        alert('Eroare la trimitere invitații: ' + (data.message || data.error || res.status))
        // clear inviting flags
        const after: Record<string, boolean> = { ...invitingIds }
        toInvite.forEach((id) => { delete after[id] })
        setInvitingIds(after)
        return
      }
      // success: remove invited users from list
      setUsers((prev) => prev.filter((u) => !toInvite.includes(String(u._id))))
      // notify parent
      onInvited && onInvited(toInvite)
      alert('Invitații trimise')
    } catch (err) {
      console.error('[InviteModal] invite error', err)
      alert('Eroare la trimitere invitații')
    } finally {
      // clear inviting flags
      const after: Record<string, boolean> = { ...invitingIds }
      ids.forEach((id) => { delete after[id] })
      setInvitingIds(after)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="fixed inset-0 bg-black opacity-30" onClick={onClose} />
      <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full z-10 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Invită participanți</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700"><Icon name="menu" className="h-5 w-5" /></button>
        </div>

        <div className="mb-4 flex items-center gap-2">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Caută utilizatori..." className="flex-1 border rounded-md px-3 py-2 text-sm" />
          <button onClick={() => inviteMany(users.map((u) => u._id))} disabled={users.length === 0} className="px-3 py-2 bg-blue-600 text-white rounded-md text-sm">Invită pe toți</button>
        </div>

        <div className="max-h-72 overflow-auto border rounded-md p-2">
          {loading && <div className="text-sm text-gray-500">Se încarcă...</div>}
          {error && <div className="text-sm text-red-500">{error}</div>}
          {!loading && users.length === 0 && <div className="text-sm text-gray-500">Nu sunt utilizatori disponibili.</div>}
          <div className="space-y-2">
            {users.map((u) => (
              <div key={u._id} className="flex items-center justify-between p-2 rounded hover:bg-gray-50">
                <div>
                  <div className="text-sm font-medium">{(u.firstName || u.lastName) ? `${(u.firstName || '').trim()} ${(u.lastName || '').trim()}`.trim() : (u.fullName || u.email)}</div>
                  <div className="text-xs text-gray-500">{u.email}</div>
                </div>
                <div>
                  <button
                    onClick={() => inviteMany([u._id])}
                    disabled={!!invitingIds[u._id]}
                    className={`px-3 py-1 rounded-md text-sm ${invitingIds[u._id] ? 'bg-gray-200 text-gray-600' : 'bg-blue-600 text-white'}`}>
                    {invitingIds[u._id] ? 'Trimitere...' : 'Invită'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-4 text-right">
          <button onClick={onClose} className="px-4 py-2 rounded-md border text-sm">Închide</button>
        </div>
      </div>
    </div>
  )
}
