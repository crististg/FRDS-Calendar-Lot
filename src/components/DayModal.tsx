import React, { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import EventModal from './EventModal'

type Props = {
  open: boolean
  date: Date | null
  onClose: () => void
  onCreate?: (date: Date | null) => void
}

export default function DayModal({ open, date, onClose, onCreate }: Props) {
  const [events, setEvents] = useState<any[] | null>(null)
  const { data: session } = useSession()

  const userId = (session as any)?.user?.id
  const [selectedEvent, setSelectedEvent] = useState<any | null>(null)

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

  const handleToggleAttend = async (ev: any, isAttending: boolean) => {
    if (!ev || !ev._id) return
    const id = ev._id || ev.id

    // optimistic update
    setEvents((prev) => {
      if (!prev) return prev
      return prev.map((item) => {
        if (String(item._id || item.id) !== String(id)) return item
        const attendees = Array.isArray(item.attendees) ? [...item.attendees] : []
        if (isAttending) {
          // remove
          return { ...item, attendees: attendees.filter((a: any) => String(a._id || a) !== String(userId)) }
        } else {
          // add
          return { ...item, attendees: [...attendees, { _id: userId }] }
        }
      })
    })

    try {
      const method = isAttending ? 'DELETE' : 'POST'
      const res = await fetch(`/api/events/${encodeURIComponent(id)}/attend`, { method })
      if (!res.ok) {
        // revert by re-fetching the day's events
        const dayStart = new Date(date!.getFullYear(), date!.getMonth(), date!.getDate(), 0, 0, 0)
        const dayEnd = new Date(date!.getFullYear(), date!.getMonth(), date!.getDate(), 23, 59, 59, 999)
        const from = encodeURIComponent(dayStart.toISOString())
        const to = encodeURIComponent(dayEnd.toISOString())
        const r2 = await fetch(`/api/events?from=${from}&to=${to}&overlap=true&populate=true`)
        if (r2.ok) {
          const d2 = await r2.json()
          setEvents(Array.isArray(d2.events) ? d2.events : [])
        }
        const data = await res.json().catch(() => ({}))
        alert('Eroare la actualizare participare: ' + (data.message || res.status))
      }
    } catch (err) {
      console.error('Attend toggle failed', err)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white rounded-xl shadow-2xl p-6">
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
            const attendees = Array.isArray(ev.attendees) ? ev.attendees : []
            const isAttending = Boolean(userId && attendees.some((a: any) => String(a._id || a) === String(userId)))
            return (
              <div key={ev._id || ev.id || ev.title} className="flex items-start gap-3 justify-between">
                <div onClick={() => setSelectedEvent(ev)} role="button" tabIndex={0} className="flex items-start gap-3 cursor-pointer">
                  <span className="h-2 w-2 rounded-full bg-blue-600 mt-2" />
                  <div>
                    <div className="text-sm font-medium">{ev.title}</div>
                    <div className="text-xs text-gray-500">{timeLabel}{ev.location ? ` • ${ev.location}` : ''}</div>
                  </div>
                </div>

                <div className="ml-3">
                  {userId ? (
                    <button
                      onClick={() => handleToggleAttend(ev, isAttending)}
                      className={`px-3 py-1 rounded-md text-sm ${isAttending ? 'bg-red-50 text-red-600' : 'bg-blue-600 text-white'}`}
                    >
                      {isAttending ? 'Renunță' : 'Participă'}
                    </button>
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
          <button onClick={() => onCreate && onCreate(date)} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md">Creează eveniment</button>
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
    </div>
  )
}
