import React, { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'

type Props = {
  open: boolean
  event: any | null
  myPairs?: any[]
  onClose: () => void
  onUploaded?: (updated: any) => void
}

export default function PairUploadModal({ open, event, myPairs = [], onClose, onUploaded }: Props) {
  const { data: session } = useSession()
  const [uploadingPairId, setUploadingPairId] = useState<string | null>(null)
  const [localEvent, setLocalEvent] = useState<any | null>(null)
  const [selectedPairId, setSelectedPairId] = useState<string | null>(null)

  useEffect(() => {
    setLocalEvent(event ? { ...event } : null)
  }, [event])

  useEffect(() => {
    if (!open) return
    if (myPairs && myPairs.length > 0) {
      setSelectedPairId((prev) => prev || String(myPairs[0]._id || myPairs[0]))
    } else {
      setSelectedPairId(null)
    }
  }, [open, myPairs])

  if (!open || !localEvent) return null

  const s = localEvent.start ? new Date(localEvent.start) : null
  const eventDate = s ? s.toLocaleDateString('ro-RO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : ''
  const eventId = String(localEvent._id || localEvent.id)

  const photosForPair = (pairId: string) => Array.isArray(localEvent.photos) ? localEvent.photos.filter((p: any) => String(p.pairId || '') === String(pairId)) : []
  const selectedList = selectedPairId ? photosForPair(selectedPairId) : []
  const selectedPairObj = selectedPairId ? (myPairs || []).find((pp) => String(pp._id || pp) === String(selectedPairId)) : null

  const handleUpload = async (pairId: string, file: File | null) => {
    if (!file) return
    try {
      setUploadingPairId(pairId)
      const q = new URLSearchParams({ filename: file.name, eventId, pairId })
      const resp = await fetch(`/api/uploads/blob?${q.toString()}`, { method: 'POST', headers: { 'Content-Type': file.type, 'X-Filename': file.name }, body: file as any })
      if (!resp.ok) {
        const t = await resp.text().catch(() => '')
        alert('Upload failed: ' + (t || resp.status))
        return
      }
      await resp.json()
      const r = await fetch(`/api/events/${encodeURIComponent(eventId)}?populate=true`)
      if (r.ok) {
        const j = await r.json()
        if (j.event) {
          setLocalEvent(j.event)
          onUploaded && onUploaded(j.event)
        }
      }
    } catch (err) {
      console.error('pair upload failed', err)
      alert('Upload failed')
    } finally {
      setUploadingPairId(null)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      <div className="relative w-full max-w-4xl bg-white rounded-xl shadow-2xl p-6">
        {/* header (match EventModal style) */}
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-lg font-semibold">Încarcă fotografii — {localEvent?.title}</h3>
            <p className="text-sm text-gray-500">{eventDate}</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
          </div>
        </div>

        {/* body: three-column responsive layout */}
        <div className="mt-4 grid grid-cols-12 gap-4">
          {/* left: pairs list */}
          <div className="col-span-12 sm:col-span-3">
            <div className="space-y-2 sm:max-h-72 max-h-40 overflow-auto">
              {(myPairs || []).map((p) => {
                const pid = String(p._id || p)
                const name1 = (p.partner1 && p.partner1.fullName) || ''
                const name2 = (p.partner2 && p.partner2.fullName) || ''
                const label = `${name1}${name2 ? ` / ${name2}` : ''}`
                const selected = String(selectedPairId) === pid
                return (
                  <button key={pid} type="button" onClick={() => setSelectedPairId(pid)} className={`w-full text-left px-3 rounded-md border ${selected ? 'bg-blue-50 border-blue-200' : 'bg-white border-gray-100'} flex items-center gap-3 h-10`}>
                    <div className={`h-8 w-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-semibold`}>{(name1 || name2).split(' ').map((s: any) => s[0] || '').slice(0, 2).join('').toUpperCase()}</div>
                    <div className="text-sm text-gray-700 truncate">{label}</div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* middle: previews */}
          <div className="col-span-12 sm:col-span-7">
            <div className="px-3 rounded-md h-10 flex items-center overflow-x-auto">
              {selectedPairId ? (
                <div className="w-full flex items-center justify-start gap-2 pl-1">
                  {selectedList.length === 0 ? (
                    <div className="text-sm text-gray-500">—</div>
                  ) : (
                    selectedList.map((ph: any) => (
                      <div key={String(ph.blobId || ph.url || ph.tempId || ph._id)} className="h-8 w-8 rounded-md overflow-hidden bg-gray-100 shrink-0">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        {ph && ph.url ? (
                          <img src={ph.url} alt={ph.filename || 'photo'} className="h-full w-full object-cover" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} />
                        ) : (
                          <div className="p-1 text-center text-xs text-gray-500">{String(ph && (ph.blobId || ph.tempId || ph._id || 'No preview'))}</div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              ) : (
                <div className="w-full text-sm text-gray-500">Selectați o pereche din stânga pentru a vedea previzualizările.</div>
              )}
            </div>
          </div>

          {/* right: upload control (aligned on same row) */}
          <div className="col-span-12 sm:col-span-2 flex items-center justify-end">
            <div>
              <input id={`pair-file-${selectedPairId || 'none'}`} key={selectedPairId || 'none'} type="file" accept="image/*" className="hidden" onChange={(e) => {
                const f = (e.target as HTMLInputElement).files?.[0] || null
                if (selectedPairId) handleUpload(selectedPairId, f)
                ;(e.target as HTMLInputElement).value = ''
              }} />
              <label htmlFor={`pair-file-${selectedPairId || 'none'}`} className={`inline-flex items-center justify-center h-10 px-4 rounded-md text-sm ${uploadingPairId === selectedPairId ? 'bg-gray-200 text-gray-700' : 'bg-blue-600 text-white'} cursor-pointer`}>{uploadingPairId === selectedPairId ? 'Încarcă…' : 'Încarcă'}</label>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}