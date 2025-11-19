import React, { useMemo, useState } from 'react'

type Attendee = any

type Props = {
  attendees: Attendee[]
}

export default function EventAttendeesList({ attendees }: Props) {
  const [q, setQ] = useState('')

  const lower = q.trim().toLowerCase()
  const filtered = useMemo(() => {
    if (!lower) return attendees
    return attendees.filter((a: any) => {
      const name = `${a.firstName || ''} ${a.lastName || ''}`.trim().toLowerCase()
      const email = (a.email || '').toLowerCase()
      const id = String(a._id || a.id || a).toLowerCase()
      return name.includes(lower) || email.includes(lower) || id.includes(lower)
    })
  }, [attendees, lower])

  return (
    <div>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Caută nume..."
        className="w-full px-3 py-2 border rounded-md text-sm mb-2"
      />

  <div className="max-h-40 overflow-auto rounded-md p-2 bg-white">
        {filtered.length === 0 ? (
          <div className="text-sm text-gray-500">Niciun participant găsit.</div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {filtered.map((a: any) => {
              const name = (a.firstName || a.lastName) ? `${a.firstName || ''} ${a.lastName || ''}`.trim() : (a.email || String(a))
              const initials = name.split(' ').filter(Boolean).slice(0,2).map(n => n[0]?.toUpperCase()).join('') || String((a._id || a).toString()).slice(-2)
              return (
                <div key={a._id || a.id || String(a)} className="flex items-center gap-2 px-2 py-1 bg-gray-50 rounded-full text-sm text-gray-700">
                  <div className="h-6 w-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-medium">{initials}</div>
                  <div className="truncate max-w-40">{name}</div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
