import React, { useEffect, useState } from 'react'
// results-only modal: no action buttons

type Props = {
  open: boolean
  event: any | null
  onClose: () => void
  onUpdated?: (updated: any) => void
}

export default function AdminResultsModal({ open, event, onClose, onUpdated }: Props) {
  const [localEvent, setLocalEvent] = useState<any | null>(event)

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [open])

  useEffect(() => { setLocalEvent(event) }, [event])

  if (!open || !localEvent) return null

  const results = Array.isArray(localEvent.results) ? localEvent.results : []
  const pairs = Array.isArray(localEvent.attendingPairs) ? localEvent.attendingPairs : []

  const getPairLabel = (pid: any) => {
    if (!pid) return '—'
    const p = pairs.find((pp: any) => String(pp._id || pp) === String(pid))
    if (!p) return String(pid)
    const n1 = p.partner1?.fullName || ''
    const n2 = p.partner2?.fullName || ''
    return `${n1}${n2 ? ` / ${n2}` : ''}`
  }

  // build groups by pairId (or 'no-pair')
  const groups: Record<string, any[]> = {}
  const labels: Record<string, string> = {}
  results.forEach((r: any, idx: number) => {
    const key = String(r.pairId ?? `no-pair-${idx}`)
    ;(groups[key] ||= []).push(r)
    if (!labels[key]) {
      if (r.pairId) labels[key] = getPairLabel(r.pairId)
      else labels[key] = 'General'
    }
  })

  const handleDelete = async (resEntry: any) => {
    if (!resEntry) return
    if (!confirm('Ștergeți acest rezultat?')) return
    try {
      const q = new URLSearchParams({ resultId: String(resEntry._id || resEntry.id) })
      const r = await fetch(`/api/events/${encodeURIComponent(localEvent._id || localEvent.id)}/results?${q.toString()}`, { method: 'DELETE' })
      if (!r.ok) {
        const t = await r.text().catch(() => '')
        alert('Ștergere eșuată: ' + (t || r.status))
        return
      }
      // refresh event data
  const rr = await fetch(`/api/events/${encodeURIComponent(localEvent._id || localEvent.id)}?populate=true`)
      if (rr.ok) {
        const j = await rr.json()
        if (j.event) {
          setLocalEvent(j.event)
          onUpdated && onUpdated(j.event)
        }
      }
    } catch (err) {
      console.error('delete result failed', err)
      alert('Ștergere eșuată')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative z-10 w-full max-w-2xl mx-auto bg-white rounded-md shadow-lg p-4 md:p-6 max-h-[85vh] overflow-auto">
        <div className="flex items-center justify-between mb-3">
          <div className="text-lg font-semibold">Rezultate — {localEvent.title}</div>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="px-3 py-1 bg-gray-100 rounded-md">Închide</button>
          </div>
        </div>

        {results.length === 0 ? (
          <div className="text-center text-sm text-gray-500 py-8">Nu există rezultate înregistrate pentru acest eveniment.</div>
        ) : (
            <div className="space-y-4">
              {Object.entries(groups).map(([key, list]) => {
                const name = labels[key] || (key.startsWith('no-pair') ? 'General' : key)
                return (
                  <div key={key} className="mb-2">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-semibold">{(name || '?').split(' ').map((s: any) => s[0] || '').slice(0,2).join('').toUpperCase()}</div>
                        <div className="font-medium">{name}</div>
                        <div className="text-xs text-gray-500">{list.length} rezultat(e)</div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      {list.map((r: any) => (
                        <div key={String(r._id || r.id)} className="flex items-start justify-between bg-gray-50 rounded-md p-3">
                          <div>
                            <div className="text-sm font-medium">{r.category || '—'}</div>
                            <div className="text-xs text-gray-500">Loc: {r.place ?? '—'} • Rundă: {r.round || '—'} • Punctaj: {r.score ?? '—'}</div>
                          </div>
                          
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
        )}
      </div>
    </div>
  )
}
