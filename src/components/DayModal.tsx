import React, { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import EventModal from './EventModal'
import PairsSelectModal from './PairsSelectModal'

type Props = {
  open: boolean
  date: Date | null
  onClose: () => void
  onCreate?: (date: Date | null) => void
  role?: string | null
  currentUserId?: string | null
}

export default function DayModal({ open, date, onClose, onCreate, role: roleProp = null, currentUserId = null }: Props) {
  const [events, setEvents] = useState<any[] | null>(null)
  const { data: session } = useSession()

  const userId = currentUserId ?? (session as any)?.user?.id
  const [selectedEvent, setSelectedEvent] = useState<any | null>(null)
  const [openPairsForEvent, setOpenPairsForEvent] = useState<any | null>(null)

  useEffect(() => {
    if (!open || !date) {
      setEvents(null)
      return
    }

    let mounted = true
    const controller = new AbortController()

    const fetchEvents = async () => {
      try {
        const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0)
        const dayEnd = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999)
        const from = encodeURIComponent(dayStart.toISOString())
        const to = encodeURIComponent(dayEnd.toISOString())

        // request populated events so we can see attendees to mark attendance
        const res = await fetch(`/api/events?from=${from}&to=${to}&overlap=true&populate=true`, { signal: controller.signal })
        if (!mounted) return
        if (!res.ok) {
          setEvents([])
          return
        }
        const data = await res.json()
        setEvents(Array.isArray(data.events) ? data.events : [])
      } catch (err) {
        if ((err as any)?.name === 'AbortError') return
        console.error('Failed to load day events', err)
        setEvents([])
      }
    }

    fetchEvents()

    return () => {
      mounted = false
      controller.abort()
    }
  }, [open, date])

  if (!open) return null

  const role = roleProp ?? (session as any)?.user?.role
  const isClub = String(role || '').toLowerCase() === 'club'
  const roleLower = String(role || '').toLowerCase()
  const isJudge = roleLower.includes('arb') || roleLower.includes('judge')

  const handleOpenPairs = async (ev: any) => {
    // refresh event then open modal
    try {
      const res = await fetch(`/api/events/${encodeURIComponent(ev._id || ev.id)}?populate=true`)
      if (res.ok) {
        const d = await res.json()
        if (d.event) {
          // update local events list
          setEvents((prev) => (prev || []).map((it) => (String(it._id || it.id) === String(d.event._id || d.event.id) ? d.event : it)))
          setOpenPairsForEvent(d.event)
        }
      }
    } catch (err) {
      console.error('Failed to refresh event', err)
      setOpenPairsForEvent(ev)
    }
  }

  const handleSavePairsForEvent = async (selectedIds: string[]) => {
    const ev = openPairsForEvent
    if (!ev || !ev._id) return
    const id = ev._id || ev.id
    const existing = (ev.attendingPairs || []).map((p: any) => String(p._id || p))
    const toAdd = selectedIds.filter((s) => !existing.includes(String(s)))
    const toRemove = existing.filter((e: string) => !selectedIds.includes(String(e)))

    // optimistic update
    setEvents((prev) => (prev || []).map((it) => (String(it._id || it.id) === String(id) ? { ...it, attendingPairs: selectedIds.map((sid) => ({ _id: sid })) } : it)))

    try {
      if (toAdd.length) {
        await fetch(`/api/events/${encodeURIComponent(id)}/attend`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pairIds: toAdd }) })
      }
      if (toRemove.length) {
        await fetch(`/api/events/${encodeURIComponent(id)}/attend`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pairIds: toRemove }) })
      }
      // refresh day events
      const dayStart = new Date(date!.getFullYear(), date!.getMonth(), date!.getDate(), 0, 0, 0)
      const dayEnd = new Date(date!.getFullYear(), date!.getMonth(), date!.getDate(), 23, 59, 59, 999)
      const from = encodeURIComponent(dayStart.toISOString())
      const to = encodeURIComponent(dayEnd.toISOString())
      const r2 = await fetch(`/api/events?from=${from}&to=${to}&overlap=true&populate=true`)
      if (r2.ok) {
        const d2 = await r2.json()
        setEvents(Array.isArray(d2.events) ? d2.events : [])
      }
    } catch (err) {
      console.error('Failed to update pairs attendance', err)
    } finally {
      setOpenPairsForEvent(null)
    }
  }
  const handleToggleAttend = async (ev: any, isAttending: boolean) => {
    if (!ev || !(ev._id || ev.id)) return
    // debug: ensure clicks reach handler
    try { console.debug('[DayModal] handleToggleAttend called', { id: ev._id || ev.id, isAttending }) } catch (e) { }
    const id = ev._id || ev.id
    // If the current user is a club, open the pairs selector (and refresh the event) so they can pick pairs.
    // If not a club, fall through to judge/judge-like handling.
    if (isClub) {
      try {
        // open immediately so user sees UI and refresh event before showing pairs
        setOpenPairsForEvent(ev)
        // background probe to warm up pairs and then refresh the event before opening the pairs modal
        fetch('/api/pairs').then((r) => r.ok ? r.json().then(() => handleOpenPairs(ev)).catch(() => {}) : null).catch(() => {})
        return
      } catch (err) {
        console.error('[DayModal] pairs probe failed', err)
      }
    }

    // Non-club users: attempt to register/unregister as a judge via API and let server validate.
    try {
      const method = isAttending ? 'DELETE' : 'POST'
      const res = await fetch(`/api/events/${encodeURIComponent(id)}/attend`, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user: true }) })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        // show server-provided message when available
        alert('Eroare la actualizare participare: ' + (data.message || res.status))
        return
      }
      const d = await res.json()
      if (d && d.event) {
        setEvents((prev) => (prev || []).map((it) => (String(it._id || it.id) === String(d.event._id || d.event.id) ? d.event : it)))
      }
    } catch (err) {
      console.error('Attend toggle failed', err)
      alert('Eroare la actualizare participare')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
  <div className="relative w-full max-w-md bg-white rounded-xl shadow-2xl p-6 z-60">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-lg font-semibold">{date ? date.toLocaleDateString('ro-RO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : 'Zi selectată'}</h3>
            <p className="text-sm text-gray-500">Evenimente planificate pentru această zi</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>

  <div className="mt-4 space-y-3">

          {events !== null && events.length === 0 && (
            <div className="text-sm text-gray-500">Nu sunt evenimente pentru această zi.</div>
          )}

          {events !== null && events.map((ev) => {
            const s = new Date(ev.start)
            const e = ev.end ? new Date(ev.end) : null
            const timeLabel = ev.allDay ? 'Toată ziua' : (e ? `${s.toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' })} - ${e.toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' })}` : s.toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' }))
            const judges = Array.isArray(ev.judges) ? ev.judges : []
            const isJudgeAttending = Boolean(userId && judges.some((a: any) => String(a._id || a) === String(userId)))
            const pairs = Array.isArray(ev.attendingPairs) ? ev.attendingPairs : []
            const hasMyPairs = isClub && Array.isArray(pairs) && pairs.some((p: any) => String(p.club) === String(userId))
            const isAtt = isClub ? hasMyPairs : isJudgeAttending
            return (
              <div key={ev._id || ev.id || ev.title} className="flex items-start gap-3 justify-between">
                <div onClick={() => setSelectedEvent(ev)} role="button" tabIndex={0} className="flex items-start gap-3 cursor-pointer">
                  <span className="h-2 w-2 rounded-full bg-blue-600 mt-2" />
                  <div>
                    <div className="text-sm font-medium">{ev.title}</div>
                    <div className="text-xs text-gray-500">{timeLabel}{(ev.address || ev.city || ev.country) ? ` • ${[ev.address, ev.city, ev.country].filter(Boolean).join(', ')}` : ''}</div>
                  </div>
                </div>

                <div className="ml-3">
                  {userId ? (
                    (() => {
                      const roleLocal = roleProp ?? (session as any)?.user?.role
                      const isClubLocal = String(roleLocal || '').toLowerCase() === 'club'
                      const judges = Array.isArray(ev.judges) ? ev.judges : []
                      const isJudgeLocal = Boolean(userId && judges.some((a: any) => String(a._id || a) === String(userId)))

                      // Club users manage pairs
                      if (isClubLocal) {
                        const hasMyPairs = Array.isArray(pairs) && pairs.some((p: any) => String(p.club) === String(userId))
                        return (
                          <button
                            onClick={() => handleOpenPairs(ev)}
                            className={`px-3 py-1 rounded-md text-sm ${hasMyPairs ? 'bg-red-50 text-red-600' : 'bg-blue-600 text-white'} cursor-pointer`}>
                            {hasMyPairs ? 'Gestionează' : 'Participă'}
                          </button>
                        )
                      }

                      // Judges (by role) can toggle attendance even if not pre-listed on the event
                      const isJudgeRole = String(roleLocal || '').toLowerCase().includes('arb') || String(roleLocal || '').toLowerCase().includes('judge')
                      if (isJudgeRole) {
                        const isAttendingJudge = Boolean(userId && Array.isArray(ev.judges) && ev.judges.some((a: any) => String(a._id || a) === String(userId)))
                        return (
                          <button onClick={() => handleToggleAttend(ev, isAttendingJudge)} className={`px-3 py-1 rounded-md text-sm ${isAttendingJudge ? 'bg-red-50 text-red-600' : 'bg-blue-600 text-white'} cursor-pointer`}>
                            {isAttendingJudge ? 'Renunță' : 'Participă'}
                          </button>
                        )
                      }

                      // Other users cannot participate directly (must be added by club)
                      return (
                        <button disabled className="px-3 py-1 rounded-md bg-gray-100 text-gray-500 text-sm cursor-not-allowed" title="Participarea se face prin club/pereche">Participă</button>
                      )
                    })()
                  ) : (
                    <div className="text-xs text-gray-400">Autentificați-vă pentru a participa</div>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        <div className="mt-6 flex items-center justify-end gap-3">
          <button onClick={onClose} className="px-3 py-2 rounded-md hover:bg-gray-100">Închide</button>
          {isJudge && (
            <button onClick={() => onCreate && onCreate(date)} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md">Creează eveniment</button>
          )}
        </div>
      </div>
      {/* Event modal opener */}
      {selectedEvent && (
        <EventModal
          open={!!selectedEvent}
          event={selectedEvent}
          onClose={() => setSelectedEvent(null)}
          onUpdated={(updated) => {
            if (!updated) return
            setEvents((prev) => (prev || []).map((it) => (String(it._id || it.id) === String(updated._id || updated.id) ? updated : it)))
            setSelectedEvent(null)
          }}
        />
      )}
      {openPairsForEvent && (
        <PairsSelectModal
          open={!!openPairsForEvent}
          initialSelected={(openPairsForEvent.attendingPairs || []).map((p: any) => String(p._id || p))}
          onClose={() => setOpenPairsForEvent(null)}
          onSave={handleSavePairsForEvent}
        />
      )}
    </div>
  )
}
