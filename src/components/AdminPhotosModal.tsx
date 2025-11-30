import React, { useEffect, useState } from 'react'
import { FiX } from 'react-icons/fi'

type Props = {
  open: boolean
  event: any | null
  onClose: () => void
}

export default function AdminPhotosModal({ open, event, onClose }: Props) {
  const [localEvent, setLocalEvent] = useState<any | null>(event)

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [open])

  useEffect(() => {
    setLocalEvent(event)
  }, [event])

  if (!open || !localEvent) return null

  const photos = Array.isArray(localEvent.photos) ? localEvent.photos : []

  // Build groups keyed by uploader id (uploadedBy) or pairId if uploadedBy missing
  const groups: Record<string, any[]> = {}
  const labels: Record<string, string> = {}

  photos.forEach((p: any, idx: number) => {
    const key = String(p.uploadedBy ?? p.pairId ?? `unknown-${idx}`)
    ;(groups[key] ||= []).push(p)

    // compute label for this key if not already
    if (!labels[key]) {
      // prefer pair label when pairId present
      if (p.pairId && Array.isArray(localEvent.attendingPairs)) {
        const pair = localEvent.attendingPairs.find((pp: any) => String(pp._id || pp) === String(p.pairId))
        if (pair) {
          const n1 = pair.partner1?.fullName || ''
          const n2 = pair.partner2?.fullName || ''
          labels[key] = `${n1}${n2 ? ` / ${n2}` : ''}` || `Pereche`
          return
        }
      }

      // try judges list
      if (p.uploadedBy && Array.isArray(localEvent.judges)) {
        const judge = localEvent.judges.find((j: any) => String(j._id || j) === String(p.uploadedBy))
        if (judge) {
          labels[key] = judge.fullName || [judge.firstName, judge.lastName].filter(Boolean).join(' ') || judge.email || String(p.uploadedBy)
          return
        }
      }

      // event creator
      if (String(localEvent.user) === String(p.uploadedBy)) {
        labels[key] = 'Creator'
        return
      }

      // fallback to uploadedBy id or unknown
      labels[key] = p.uploadedBy ? String(p.uploadedBy) : (p.pairId ? String(p.pairId) : 'Utilizator')
    }
  })

  const handleDelete = async (photo: any) => {
    if (!confirm('Ștergeți această fotografie?')) return
    try {
      const qp: any = {}
      if (photo.blobId) qp.blobId = photo.blobId
      else if (photo.url) qp.url = photo.url
      else if (photo._id) qp.url = photo._id
      const q = new URLSearchParams(qp as any)
      const dres = await fetch(`/api/events/${encodeURIComponent(localEvent._id || localEvent.id)}/photos?${q.toString()}`, { method: 'DELETE' })
      if (!dres.ok) {
        const t = await dres.text().catch(() => '')
        alert('Ștergere eșuată: ' + (t || dres.status))
        return
      }
      // remove photo locally
      setLocalEvent((prev: any) => {
        if (!prev) return prev
        const next = { ...prev }
        next.photos = Array.isArray(next.photos) ? next.photos.filter((pp: any) => !(String(pp.blobId || pp.url || pp._id) === String(photo.blobId || photo.url || photo._id))) : []
        return next
      })
    } catch (err) {
      console.error('delete photo failed', err)
      alert('Ștergere eșuată')
    }
  }

  return (
    // centered modal on all viewports
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      <div className="relative z-10 w-full max-w-lg md:max-w-4xl mx-auto bg-white rounded-md shadow-lg p-4 md:p-6 max-h-[85vh] overflow-auto">
        <div className="flex items-center justify-between mb-3">
          <div className="text-lg font-semibold">Fotografii — {localEvent.title}</div>
          <div className="flex items-center gap-2">
            <a
              href={`/api/events/${encodeURIComponent(localEvent._id || localEvent.id)}/download-photos?all=1`}
              className="px-3 py-1 bg-blue-600 text-white rounded-md text-sm"
            >
              Descarcă toate
            </a>
            <button onClick={onClose} className="px-3 py-1 bg-gray-100 rounded-md">Închide</button>
          </div>
        </div>

        {photos.length === 0 ? (
          <div className="text-center text-sm text-gray-500 py-8">Nu s-au încărcat fotografii pentru acest eveniment.</div>
        ) : (
          <div className="space-y-4">
            {Object.entries(groups).map(([uid, ps]) => {
              const name = labels[uid] || (String(localEvent.user) === uid ? 'Creator' : uid)
              return (
                <div key={uid} className="mb-2">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-semibold">{(name || '?').split(' ').map((s: any) => s[0] || '').slice(0,2).join('').toUpperCase()}</div>
                      <div className="font-medium">{name}</div>
                      <div className="text-xs text-gray-500">{ps.length} foto</div>
                    </div>
                    {/* download per uploader when uploadedBy present */}
                    <a
                      href={`/api/events/${encodeURIComponent(localEvent._id || localEvent.id)}/download-photos?userId=${encodeURIComponent(uid)}`}
                      className="px-2 py-1 bg-gray-100 rounded-md text-sm"
                    >
                      Descarcă participante
                    </a>
                  </div>

                  <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-1">
                    {ps.map((p: any, i: number) => (
                      <div key={p.blobId || p.url || i} className="h-28 w-20 relative bg-gray-100 rounded-md overflow-hidden">
                        <button onClick={(e) => { e.stopPropagation(); handleDelete(p) }} title="Șterge" aria-label="Șterge" className="absolute right-1 top-1 z-10 h-6 w-6 flex items-center justify-center bg-white/90 hover:bg-white rounded-full shadow">
                          <FiX className="h-3 w-3 text-red-600" />
                        </button>
                        <img loading="lazy" src={p.url} alt={p.filename || 'photo'} className="h-full w-full object-cover" />
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
