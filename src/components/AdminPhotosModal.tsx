import React, { useEffect } from 'react'

type Props = {
  open: boolean
  event: any | null
  onClose: () => void
}

export default function AdminPhotosModal({ open, event, onClose }: Props) {
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [open])

  if (!open || !event) return null

  const photos = event.photos || []
  const groups: Record<string, any[]> = {}
  photos.forEach((p: any) => {
    const key = String(p.uploadedBy || 'unknown')
    ;(groups[key] ||= []).push(p)
  })

  return (
    // centered modal on all viewports
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      <div className="relative z-10 w-full max-w-lg md:max-w-4xl mx-auto bg-white rounded-md shadow-lg p-4 md:p-6 max-h-[85vh] overflow-auto">
        <div className="flex items-center justify-between mb-3">
          <div className="text-lg font-semibold">Fotografii — {event.title}</div>
          <div className="flex items-center gap-2">
            <a
              href={`/api/events/${encodeURIComponent(event._id || event.id)}/download-photos?all=1`}
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
              const attendee = (event.attendees || []).find((a: any) => String(a._id || a.id) === String(uid))
              const name = attendee ? attendee.fullName || [attendee.firstName, attendee.lastName].filter(Boolean).join(' ') || attendee.email : (String(event.user) === String(uid) ? 'Creator' : 'Utilizator')
              return (
                <div key={uid} className="mb-2">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-semibold">{(name || '?').split(' ').map((s: any) => s[0] || '').slice(0,2).join('').toUpperCase()}</div>
                      <div className="font-medium">{name}</div>
                      <div className="text-xs text-gray-500">{ps.length} foto</div>
                    </div>
                    <a
                      href={`/api/events/${encodeURIComponent(event._id || event.id)}/download-photos?userId=${encodeURIComponent(uid)}`}
                      className="px-2 py-1 bg-gray-100 rounded-md text-sm"
                    >
                      Descarcă participante
                    </a>
                  </div>

                  <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-1">
                    {ps.map((p: any, i: number) => (
                      <div key={p.blobId || p.url || i} className="h-12 w-20 relative bg-gray-100 rounded-md overflow-hidden">
                        <img src={p.url} alt={p.filename || 'photo'} className="h-full w-full object-cover" />
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
