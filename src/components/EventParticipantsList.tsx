import React, { useMemo, useState } from 'react'

type Attendee = {
  _id?: string
  id?: string
  firstName?: string
  lastName?: string
  fullName?: string
  email?: string
}

type Pair = {
  _id?: string
  partner1?: { fullName?: string }
  partner2?: { fullName?: string }
  pairCategory?: string
  classLevel?: string
  coach?: string
}

type Props = {
  attendees?: Attendee[]
  pairs?: Pair[]
}

function initialsForName(name?: string) {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[1][0]).toUpperCase()
}

export default function EventParticipantsList({ attendees = [], pairs = [] }: Props) {
  const [q, setQ] = useState('')

  const listAttendees = useMemo(() => {
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

  const listPairs = useMemo(() => {
    const term = q.trim().toLowerCase()
    if (!term) return pairs
    return pairs.filter((p) => {
      const a1 = (p.partner1 && p.partner1.fullName) || ''
      const a2 = (p.partner2 && p.partner2.fullName) || ''
      const combined = (a1 + ' ' + a2).toLowerCase()
      const meta = ((p.pairCategory || '') + ' ' + (p.classLevel || '') + ' ' + (p.coach || '')).toLowerCase()
      return combined.includes(term) || meta.includes(term)
    })
  }, [pairs, q])

  // prefer showing pairs if any are present
  const showPairs = Array.isArray(pairs) && pairs.length > 0

  return (
    <div>
      <div className="mt-3 mb-2">
        <div className="relative inline-block">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
            <path d="M21 21l-4.35-4.35" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="11" cy="11" r="6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={showPairs ? "Caută perechi..." : "Caută participanți..."}
            className="w-48 h-8 pl-10 pr-3 rounded-full bg-white border border-gray-200 text-sm placeholder-gray-400 shadow-sm focus:outline-none focus:ring-0 focus:border-gray-300"
          />
        </div>
      </div>

      <div className="max-h-56 overflow-auto pt-1 pl-1">
        {showPairs ? (
          (listPairs.length === 0) ? (
            <div className="text-sm text-gray-500">Nu există perechi.</div>
          ) : (
            <div className="flex flex-col gap-2">
              {listPairs.map((p) => {
                const id = String(p._id || '')
                const name1 = (p.partner1 && p.partner1.fullName) || ''
                const name2 = (p.partner2 && p.partner2.fullName) || ''
                const label = `${name1} / ${name2}`
                const subtitle = p.pairCategory || p.classLevel || p.coach || ''
                return (
                  <div key={id} className="flex items-center gap-2 px-3 py-1 bg-gray-100 rounded-md">
                    <div className="flex items-center gap-1">
                      <div className="flex items-center justify-center h-6 w-6 rounded-full bg-blue-600 text-white text-xs font-semibold">{initialsForName(name1)}</div>
                      <div className="flex items-center justify-center h-6 w-6 rounded-full bg-blue-600 text-white text-xs font-semibold">{initialsForName(name2)}</div>
                    </div>
                    <div className="truncate">
                      <div className="text-sm font-medium">{label}</div>
                      <div className="text-xs text-gray-500">{subtitle}</div>
                    </div>
                  </div>
                )
              })}
            </div>
          )
        ) : (
          listAttendees.length === 0 ? (
            <div className="text-sm text-gray-500">Nu există participanți.</div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {listAttendees.map((a) => {
                const name = [a.firstName, a.lastName].filter(Boolean).join(' ') || a.fullName || a.email || 'N/A'
                const initials = (() => {
                  const parts = name.trim().split(/\s+/).filter(Boolean)
                  if (parts.length === 0) return '?'
                  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
                  return (parts[0][0] + parts[1][0]).toUpperCase()
                })()
                return (
                  <div key={String(a._id || a.id || a.email || name)} className="inline-flex items-center gap-2 px-3 py-1 bg-gray-100 rounded-full text-sm">
                    <div className="flex items-center justify-center h-6 w-6 rounded-full bg-blue-600 text-white text-xs font-semibold">{initials}</div>
                    <div className="truncate max-w-[10rem]">{name}</div>
                  </div>
                )
              })}
            </div>
          )
        )}
      </div>
    </div>
  )
}
