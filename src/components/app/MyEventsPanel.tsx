import React from 'react'
import EventModal from '../../components/EventModal'
import PairUploadModal from '../../components/PairUploadModal'
import { FiX } from 'react-icons/fi'

type Props = {
  attendingEvents: any[] | null
  attendingLoading: boolean
  attendingError: string | null
  userId?: string | null
  viewerId?: string | null
  role?: string | undefined
  setSelectedMyEvent: (e: any) => void
  setPairUploadEvent: (e: any) => void
  setPairUploadOpen: (v: boolean) => void
  uploadFileForEvent: (file: File | null, ev: any) => Promise<void>
  handleUnattend: (ev: any) => Promise<void>
  onEventUpdated?: (updated: any) => void
}

export default function MyEventsPanel({ attendingEvents, attendingLoading, attendingError, userId, viewerId, role, setSelectedMyEvent, setPairUploadEvent, setPairUploadOpen, uploadFileForEvent, handleUnattend, onEventUpdated }: Props) {

  const handleDeletePhoto = async (ev: any, photo: any) => {
    if (!ev || !photo) return
    if (!confirm('Ștergeți această fotografie?')) return
    try {
      const eventId = String(ev._id || ev.id)
      const qp: any = {}
      if (photo.blobId) qp.blobId = photo.blobId
      else if (photo.url) qp.url = photo.url
      else if (photo._id) qp.url = photo._id
      const q = new URLSearchParams(qp as any)
      const dres = await fetch(`/api/events/${encodeURIComponent(eventId)}/photos?${q.toString()}`, { method: 'DELETE' })
      if (!dres.ok) {
        const t = await dres.text().catch(() => '')
        alert('Ștergere eșuată: ' + (t || dres.status))
        return
      }
      // refresh single event and notify parent
      const rr = await fetch(`/api/events/${encodeURIComponent(eventId)}?populate=true`)
      if (rr.ok) {
        const j = await rr.json()
        if (j.event) {
          onEventUpdated && onEventUpdated(j.event)
        }
      }
    } catch (err) {
      console.error('delete photo failed', err)
      alert('Ștergere eșuată')
    }
  }
  return (
    <div className="p-4 md:p-4 md:p-6">
      <h4 className="text-lg font-semibold mb-4">Evenimente la care particip</h4>
      {attendingError && <div className="text-sm text-red-500">{attendingError}</div>}
      {!attendingLoading && attendingEvents && attendingEvents.length === 0 && (
        <div className="text-sm text-gray-500">Nu participați la niciun eveniment.</div>
      )}

      <div className="space-y-3">
        {(attendingEvents || []).map((ev) => {
          const pairs = Array.isArray(ev.attendingPairs) ? ev.attendingPairs : []
          const myPairs = pairs.filter((p: any) => String(p.club || p) === String(userId))
          const isJudge = Boolean(viewerId && Array.isArray(ev.judges) && ev.judges.some((j: any) => String(j._id || j) === String(viewerId)))
          return (
            <div key={ev._id || ev.id} onClick={() => setSelectedMyEvent(ev)} className="flex flex-col md:flex-row items-start gap-3 justify-between cursor-pointer">
              <div className="flex items-start gap-3 flex-1 min-w-0">
                <span className="h-2 w-2 rounded-full bg-blue-600 mt-2" />
                <div>
                  <div className="text-sm font-medium">{ev.title}</div>
                  <div className="text-xs text-gray-500">{new Date(ev.start).toLocaleString('ro-RO')}{(ev.address || ev.city || ev.country) ? ` • ${[ev.address, ev.city, ev.country].filter(Boolean).join(', ')}` : ''}</div>
                  {myPairs.length > 0 && (
                    <div className="text-xs text-gray-400 mt-1">Perechile mele: {myPairs.length}</div>
                  )}
                  {(!myPairs || myPairs.length === 0) && isJudge && (
                    <div className="text-xs text-gray-400 mt-1">Particip ca arbitru</div>
                  )}

                  {role && String(role).toLowerCase() === 'club' && myPairs.length > 0 && (
                    <div className="mt-3">
                      <div className="flex gap-2 overflow-x-auto sm:flex-wrap sm:overflow-visible py-1">
                        {myPairs.map((p: any) => {
                          const id = String(p._id || p)
                          const name1 = (p.partner1 && p.partner1.fullName) || ''
                          const name2 = (p.partner2 && p.partner2.fullName) || ''
                          const label = `${name1}${name2 ? ` / ${name2}` : ''}`
                          const initials = (n: string) => {
                            const parts = (n || '').trim().split(/\s+/).filter(Boolean)
                            if (parts.length === 0) return '?'
                            if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
                            return (parts[0][0] + parts[1][0]).toUpperCase()
                          }
                          return (
                            <div key={id} className="inline-flex items-center gap-2 px-2 py-1 bg-white border border-gray-100 rounded-full shadow-sm min-w-max">
                              <div className="flex items-center justify-center h-5 w-5 sm:h-6 sm:w-6 rounded-full bg-blue-600 text-white text-xs font-semibold">{initials(name1 || name2)}</div>
                              <div className="text-xs sm:text-sm text-gray-700 truncate max-w-40 sm:max-w-56">{label}</div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div onClick={(e) => e.stopPropagation()} className="shrink-0 flex items-center gap-2 md:ml-4 mt-3 md:mt-0">
                {isJudge && Array.isArray(ev.photos) && ev.photos.length > 0 && (
                  <div className="flex items-center gap-2">
                    {ev.photos.slice(0, 3).map((ph: any) => (
                      <div key={String(ph._id || ph.blobId || ph.tempId || ph.url)} className="relative h-6 w-6 rounded-md overflow-hidden bg-gray-100">
                        <button onClick={(e) => { e.stopPropagation(); handleDeletePhoto(ev, ph) }} title="Șterge" aria-label="Șterge" className="absolute right-0 -top-1 z-10 h-5 w-5 flex items-center justify-center bg-white/90 hover:bg-white rounded-full shadow">
                          <FiX className="h-3 w-3 text-red-600" />
                        </button>
                        {ph && ph.url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img loading="lazy" src={ph.url} alt={ph.filename || 'photo'} className="h-full w-full object-cover" />
                        ) : (
                          <div className="h-full w-full bg-gray-200" />
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {myPairs && myPairs.length > 0 ? (
                  <button type="button" onClick={() => { setPairUploadEvent(ev); setPairUploadOpen(true) }} className="px-3 py-1 rounded-md text-sm bg-gray-50 text-gray-700 cursor-pointer hover:bg-gray-100">Încarcă</button>
                ) : (
                  <>
                    <input id={`file-${ev._id || ev.id}`} type="file" accept="image/*" className="hidden" onChange={(e) => { const file = (e.target as HTMLInputElement).files?.[0] || null; uploadFileForEvent(file, ev); (e.target as HTMLInputElement).value = '' }} />
                    {(() => {
                      const userPhotosCount = (ev.photos || []).filter((p: any) => String(p.uploadedBy || '') === String(userId || '')).length
                      if (userPhotosCount >= 4) return <span className="px-3 py-1 rounded-md text-sm bg-gray-100 text-gray-400">Limită (4)</span>
                      return <label htmlFor={`file-${ev._id || ev.id}`} className="px-3 py-1 rounded-md text-sm bg-gray-50 text-gray-700 cursor-pointer">Încarcă</label>
                    })()}
                  </>
                )}
                <button onClick={() => handleUnattend(ev)} className="px-3 py-1 rounded-md text-sm bg-red-50 text-red-600">Renunță</button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
