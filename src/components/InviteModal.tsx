import React, { useEffect, useState, useRef } from 'react'

type UserRow = {
  _id?: string
  firstName?: string
  lastName?: string
  fullName?: string
  email: string
  clubName?: string
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
  const [mode, setMode] = useState<'pairs' | 'clubs' | 'judges'>('pairs')
  const [pairs, setPairs] = useState<any[]>([])
  const [selectedPairIds, setSelectedPairIds] = useState<string[]>([])

  const togglePair = (id: string) => {
    setSelectedPairIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : prev.concat([id]))
  }

  const renderCount = useRef(0)
  renderCount.current += 1
  // lightweight diagnostic to help HMR / hook-order issues — remove later
  if (process.env.NODE_ENV !== 'production') {
    // eslint-disable-next-line no-console
    console.log('[InviteModal] render', { open, mode, query, render: renderCount.current })
  }

  useEffect(() => {
    if (!open) return
    let cancelled = false
    const fetchUsers = async () => {
      setLoading(true)
      try {
        if (mode === 'clubs') {
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
          return
        }

        // pairs mode
        if (mode === 'pairs') {
          const res = await fetch('/api/pairs?populate=true')
          if (!res.ok) { setPairs([]); return }
          const data = await res.json()
          if (cancelled) return
          // server may return club as populated object or id; normalize to include clubName
          const normalized = (data.pairs || []).map((p: any) => {
            const clubObj = p.club && typeof p.club === 'object' ? p.club : null
            return { ...p, clubName: clubObj ? (clubObj.clubName || clubObj.fullName || clubObj.email) : String(p.club || '') }
          })
          setPairs(normalized)
          return
        }

        // judges mode has no search results
        setUsers([])
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
  }, [open, query, mode])

  // Keep component mounted even when `open` is false to avoid hook-order / HMR issues
  // We hide it visually and make it non-interactive when closed.

  const inviteUser = async (u: UserRow) => {
    if (!eventId) return
    setStatusMap((s) => ({ ...s, [u.email]: 'sending' }))
    try {
      const payload: any = {}
      // If we're in clubs mode, invite the club (send clubIds) so the club contact receives the email.
      if (mode === 'clubs') {
        if (u._id) payload.clubIds = [u._id]
        else payload.emails = [u.email]
      } else {
        // prefer sending userIds so server uses the canonical email from DB
        if (u._id) payload.userIds = [u._id]
        else payload.emails = [u.email]
      }

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

  const inviteSelectedPairs = async () => {
    if (!eventId) {
      alert('Eveniment invalid')
      return
    }
    if (!selectedPairIds || selectedPairIds.length === 0) {
      alert('Nu ați selectat nicio pereche.')
      return
    }
    try {
      // diagnostic
      // eslint-disable-next-line no-console
      console.log('[InviteModal] inviting pairs', { eventId, selectedPairIds })
      const res = await fetch(`/api/events/${eventId}/invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pairIds: selectedPairIds }),
      })
      // eslint-disable-next-line no-console
      console.log('[InviteModal] invite pairs response', res.status)
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        console.error('Invite pairs failed', d)
        alert('Eroare la trimitere invitați: ' + (d?.error || d?.message || res.status))
        return
      }
      alert('Invitațiile către perechi au fost trimise.')
      onInvited?.('pairs')
      setSelectedPairIds([])
    } catch (err) {
      console.error('Invite pairs error', err)
      alert('Eroare la trimitere invitați')
    }
  }

  const inviteClubSelf = async () => {
    if (!eventId) return
    try {
      const res = await fetch(`/api/events/${eventId}/invite`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ clubIds: [eventId] }) })
      if (!res.ok) console.error('Invite club failed')
      else onInvited?.('club')
    } catch (err) {
      console.error('Invite club error', err)
    }
  }

  const inviteAllJudges = async () => {
    if (!eventId) return
    try {
      const res = await fetch(`/api/events/${eventId}/invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inviteJudges: true }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        console.error('Invite judges failed', d)
        return
      }
      onInvited?.('judges')
    } catch (err) {
      console.error('Invite judges error', err)
    }
  }

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center transition-opacity ${open ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
      aria-hidden={!open}
    >
      <div className={`absolute inset-0 bg-black/40 transition-opacity ${open ? 'opacity-100' : 'opacity-0'}`} onClick={open ? onClose : undefined} />
      <div className={`relative w-full max-w-2xl bg-white rounded-xl shadow-2xl p-6 transform transition-all ${open ? 'translate-y-0 scale-100 opacity-100' : 'translate-y-4 scale-95 opacity-0'}`}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold">Invită participanți</h3>
            <p className="text-sm text-gray-500">Selectează perechi, cluburi sau arbitri pentru a le trimite invitații</p>
          </div>
          <div className="text-sm text-gray-500">Eveniment: {eventId || '-'}</div>
        </div>

        <div className="mt-4 flex items-center gap-2">
            <div className="inline-flex rounded-md bg-gray-50 p-1">
            <button onClick={() => setMode('pairs')} className={`px-3 py-1 text-sm rounded ${mode === 'pairs' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}>Perechi</button>
            <button onClick={() => setMode('clubs')} className={`px-3 py-1 text-sm rounded ${mode === 'clubs' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}>Cluburi</button>
            <button onClick={() => setMode('judges')} className={`px-3 py-1 text-sm rounded ${mode === 'judges' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}>Arbitri</button>
          </div>
          <div className="flex-1">
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Caută după nume sau email" className="w-full px-3 py-2 border rounded-md bg-gray-50" />
          </div>
        </div>

        <div className="mt-4 max-h-60 overflow-auto">
          {mode === 'pairs' ? (
            pairs.length === 0 ? (
              <div className="text-sm text-gray-500">Nicio pereche găsită.</div>
            ) : (
              <div className="space-y-2">
                {pairs.map((p) => {
                  const id = String(p._id || '')
                  const name1 = p.partner1?.fullName || ''
                  const name2 = p.partner2?.fullName || ''
                  const label = `${name1}${name2 ? ` / ${name2}` : ''}`
                  const selected = selectedPairIds.includes(id)
                  return (
                    <div key={id} className="flex items-center justify-between gap-4 p-2 rounded-md hover:bg-gray-50">
                      <div>
                        <div className="text-sm font-medium">{label || `Pereche ${id}`}</div>
                        <div className="text-xs text-gray-500">Club: {p.clubName || p.club}</div>
                      </div>
                      <div>
                        <button onClick={() => togglePair(id)} className={`px-3 py-1 text-sm rounded ${selected ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'}`}>{selected ? 'Deselectează' : 'Selectează'}</button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          ) : mode === 'judges' ? (
            <div className="p-2">
              <div className="text-sm text-gray-700">Invită toți arbitrii și formatorii înregistrati.</div>
              <div className="mt-2">
                        <button type="button" onClick={() => inviteAllJudges()} className="px-4 py-2 bg-blue-600 text-white rounded">Invită arbitrii</button>
              </div>
            </div>
          ) : mode === 'clubs' ? (
            (!loading && users.length === 0) ? (
              <div className="text-sm text-gray-500">Niciun utilizator găsit.</div>
            ) : users.length > 0 ? (
              <div className="space-y-2">
                {users.map((u) => {
                  const id = u.email || u._id || ''
                  const status = statusMap[u.email] || 'idle'
                  const personName = [u.firstName, u.lastName].filter(Boolean).join(' ') || u.fullName || u.email
                  const displayName = mode === 'clubs' ? (u.clubName || personName) : personName
                  return (
                    <div key={id} className="flex items-center justify-between gap-4 p-2 rounded-md hover:bg-gray-50">
                      <div>
                        <div className="text-sm font-medium">{displayName}</div>
                        <div className="text-xs text-gray-500">{u.email} {u.role ? `· ${u.role}` : ''}</div>
                      </div>
                      <div>
                        {status === 'sent' ? (
                          <span className="text-xs text-green-600">Trimis</span>
                        ) : status === 'sending' ? (
                          <button className="px-3 py-1 text-sm bg-gray-200 rounded" disabled>Se trimite…</button>
                        ) : (
                          <button type="button" onClick={() => inviteUser(u)} className="px-3 py-1 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded">Invită</button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : null
          ) : null}
        </div>

        <div className="flex items-center justify-end gap-3 mt-4">
          {mode === 'pairs' && (
            <button type="button" onClick={inviteSelectedPairs} disabled={selectedPairIds.length === 0} className="px-4 py-2 bg-blue-600 text-white rounded">Invită perechile selectate</button>
          )}
          {mode === 'clubs' && (
            <button type="button" onClick={() => inviteClubSelf()} className="px-4 py-2 bg-blue-600 text-white rounded">Invită clubul meu</button>
          )}
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm rounded-md hover:bg-gray-100">Închide</button>
        </div>
      </div>
    </div>
  )
}