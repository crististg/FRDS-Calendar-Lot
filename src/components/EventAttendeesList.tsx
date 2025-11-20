import React, { useMemo, useState } from 'react'

type Attendee = {
  _id?: string
  id?: string
  firstName?: string
  lastName?: string
  fullName?: string
  email?: string
}

type Props = {
  attendees: Attendee[]
}

function initials(a: Attendee) {
  const name = (a.firstName || '') + ' ' + (a.lastName || '')
  const full = (a.fullName || '').trim()
  const source = full || name || (a.email || '')
  const parts = source.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[1][0]).toUpperCase()
}

export default function EventAttendeesList({ attendees }: Props) {
  const [q, setQ] = useState('')

  const list = useMemo(() => {
    const term = q.trim().toLowerCase()
    if (!term) return attendees
    return attendees.filter((a) => {
      const name = ((a.firstName || '') + ' ' + (a.lastName || '')).trim()
      const full = (a.fullName || '').trim()
      const email = (a.email || '').toLowerCase()
      return (
        (name && name.toLowerCase().includes(term)) ||
        (full && full.toLowerCase().includes(term)) ||
        (email && email.includes(term))
      )
    })
  }, [attendees, q])

  return (
    <div>
      <div className="mb-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Caută participanți..."
          className="w-full px-3 py-2 border rounded-md text-sm"
        />
      </div>

      <div className="max-h-56 overflow-auto p-1">
        {list.length === 0 ? (
          <div className="text-sm text-gray-500">Nu există participanți.</div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {list.map((a) => {
              const name = [a.firstName, a.lastName].filter(Boolean).join(' ') || a.fullName || a.email || 'N/A'
              return (
                <div key={String(a._id || a.id || a.email || name)} className="inline-flex items-center gap-2 px-3 py-1 bg-gray-100 rounded-full text-sm">
                  <div className="flex items-center justify-center h-6 w-6 rounded-full bg-blue-600 text-white text-xs font-semibold">{initials(a)}</div>
                  <div className="truncate max-w-[10rem]">{name}</div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
