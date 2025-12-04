import React, { useEffect, useRef, useState } from 'react'
import { FiEdit, FiTrash2, FiX, FiPlus } from 'react-icons/fi'
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
  const [showResultModal, setShowResultModal] = useState(false)
  const [activeTab, setActiveTab] = useState<'results' | 'photos'>('results')
  const [mainTab, setMainTab] = useState<'photos' | 'results'>('photos')
  const [resultPlace, setResultPlace] = useState<number | ''>('')
  const [resultParticipants, setResultParticipants] = useState<number | ''>('')
  const [resultCategory, setResultCategory] = useState<string>('')
  // score/`punctaj` removed per new requirements
  const [savingResult, setSavingResult] = useState(false)
  const [editingResultId, setEditingResultId] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [selectedPhotoFiles, setSelectedPhotoFiles] = useState<File[]>([])

  // trigger system file picker and handle selected file
  const triggerFilePicker = () => {
    if (!selectedPairId) return
    fileInputRef.current && fileInputRef.current.click()
  }

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    // capture the file synchronously — React may nullify the synthetic event after an await
    const input = e.currentTarget
    const f = input.files && input.files[0]
    if (!f) return
    // call the existing upload handler for the currently selected pair
    await handleUploadPhoto(selectedPairId as string, f)
    // clear the native input via ref (safer than using the synthetic event after await)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

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

  // When user switches to the Results main tab, open the inline result form automatically
  useEffect(() => {
    if (mainTab === 'results') {
      setShowResultModal(true)
      setEditingResultId(null)
      setResultPlace('')
      setResultParticipants('')
      setResultCategory('')
    } else {
      // close the inline form when leaving results
      setShowResultModal(false)
      setEditingResultId(null)
    }
  }, [mainTab])

  if (!open || !localEvent) return null

  const s = localEvent.start ? new Date(localEvent.start) : null
  const eventDate = s ? s.toLocaleDateString('ro-RO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : ''
  const eventId = String(localEvent._id || localEvent.id)

  const photosForPair = (pairId: string) => Array.isArray(localEvent.photos) ? localEvent.photos.filter((p: any) => String(p.pairId || '') === String(pairId)) : []
  const selectedList = selectedPairId ? photosForPair(selectedPairId) : []
  const selectedPairObj = selectedPairId ? (myPairs || []).find((pp) => String(pp._id || pp) === String(selectedPairId)) : null

  type ResultFields = { place?: number | null; participants?: number | null; category?: string | null }

  const handleUploadPhoto = async (pairId: string, file: File | null) => {
    if (!file) return
    try {
      setUploadingPairId(pairId)
      // upload the file only
      const q = new URLSearchParams({ filename: file.name, eventId, pairId })
      const headers: any = { 'Content-Type': file.type, 'X-Filename': file.name }
      const resp = await fetch(`/api/uploads/blob?${q.toString()}`, { method: 'POST', headers, body: file as any })
      if (!resp.ok) {
        const t = await resp.text().catch(() => '')
        alert('Upload failed: ' + (t || resp.status))
        return
      }
      await resp.json().catch(() => null)

      // refresh event after photo upload
      const r = await fetch(`/api/events/${encodeURIComponent(eventId)}?populate=true`)
      if (r.ok) {
        const j = await r.json()
        if (j.event) {
          setLocalEvent(j.event)
          onUploaded && onUploaded(j.event)
        }
      }
    } catch (err) {
      console.error('photo upload failed', err)
      alert('Upload failed')
    } finally {
      setUploadingPairId(null)
    }
  }

  const handleDeletePhoto = async (photo: any) => {
    if (!photo) return
    try {
      // prefer sending the photo document id when available, fall back to blobId or url
      console.log('[PairUploadModal] delete photo requested', { eventId, photo })
      const qp: any = {}
      if (photo._id) qp.photoId = String(photo._id)
      else if (photo.blobId) qp.blobId = photo.blobId
      else if (photo.url) qp.url = photo.url
      const q = new URLSearchParams(qp as any)
      const url = `/api/events/${encodeURIComponent(eventId)}/photos?${q.toString()}`
      console.log('[PairUploadModal] DELETE url', url)
      const dres = await fetch(url, { method: 'DELETE', credentials: 'include' })
      if (!dres.ok) {
        const t = await dres.text().catch(() => '')
        console.error('[PairUploadModal] delete failed', dres.status, t)
        alert('Ștergere eșuată: ' + (t || dres.status))
        return
      }
      console.log('[PairUploadModal] delete response ok', dres.status)
      // refresh
      const rr = await fetch(`/api/events/${encodeURIComponent(eventId)}?populate=true`)
      if (rr.ok) {
        const j = await rr.json()
        if (j.event) {
          setLocalEvent(j.event)
          onUploaded && onUploaded(j.event)
        }
      }
    } catch (err) {
      console.error('delete photo failed', err)
      alert('Ștergere eșuată')
    }
  }

  const handleSaveResult = async (pairId: string, result: ResultFields) => {
    try {
      setSavingResult(true)
      const body: any = {}
      if (pairId) body.pairId = pairId
      if (result.place !== undefined && result.place !== null) body.place = Number(result.place)
  if (result.participants !== undefined && result.participants !== null) body.participants = Number(result.participants)
  if (result.category !== undefined) body.category = result.category

      let res
      if (editingResultId) {
        // update existing result
        body.resultId = editingResultId
        res = await fetch(`/api/events/${encodeURIComponent(eventId)}/results`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      } else {
        // create new
        res = await fetch(`/api/events/${encodeURIComponent(eventId)}/results`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      }

      if (!res.ok) {
        const t = await res.text().catch(() => '')
        alert('Saving result failed: ' + (t || res.status))
      } else {
        // refresh event after saving result
        const r = await fetch(`/api/events/${encodeURIComponent(eventId)}?populate=true`)
        if (r.ok) {
          const j = await r.json()
          if (j.event) {
            setLocalEvent(j.event)
            onUploaded && onUploaded(j.event)
          }
        }
      }
    } catch (err) {
      console.error('save result failed', err)
      alert('Saving result failed')
    } finally {
      setSavingResult(false)
      setEditingResultId(null)
    }
  }

  // whether current inline result fields are valid for saving
  const canSaveResult = (resultPlace !== '' && resultParticipants !== '' && String(resultCategory || '').trim() !== '')

  return (<>
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

  <div className="relative w-full max-w-4xl bg-white rounded-lg shadow-lg p-6 border border-gray-100">
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
                    <div className={`h-8 w-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-semibold`}>{(name1 || name2).split(' ').map((s: any) => s[0] || '').slice(0, 2).join('').toUpperCase()}</div>
                    <div className="text-sm text-gray-700 truncate">{label}</div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* middle: previews / results tabs */}
          <div className="col-span-12 sm:col-span-7">
            <div className="rounded-md">
              <div className="flex gap-4 items-center justify-start pb-2 ml-1">
                <button type="button" onClick={() => setMainTab('photos')} className={`px-3 py-1 rounded-t-md border-b-2 ${mainTab === 'photos' ? 'border-gray-300 text-gray-900' : 'border-transparent text-gray-600 hover:text-gray-800'}`}>Fotografii</button>
                <button type="button" onClick={() => setMainTab('results')} className={`px-3 py-1 rounded-t-md border-b-2 ${mainTab === 'results' ? 'border-gray-300 text-gray-900' : 'border-transparent text-gray-600 hover:text-gray-800'}`}>Rezultate</button>
              </div>

              <div className="mt-3">
                {mainTab === 'photos' ? (
                  <div className="px-3 rounded-md flex flex-col gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      {selectedPairId ? (
                        <div className="w-full flex items-center justify-start gap-2 pl-1">
                          {selectedList.length === 0 ? (
                            <div className="text-sm text-gray-500">—</div>
                          ) : (
                            selectedList.map((ph: any) => (
                              <div key={String(ph.blobId || ph.url || ph.tempId || ph._id)} className="relative h-28 w-28 rounded-md overflow-hidden bg-gray-100 shrink-0 border border-gray-100">
                                {/* delete button overlay */}
                                  <button onClick={(e) => { e.stopPropagation(); console.log('[PairUploadModal] delete clicked', ph); handleDeletePhoto(ph) }} title="Șterge" aria-label="Șterge" className="absolute right-1 top-1 z-10 h-6 w-6 flex items-center justify-center bg-white/90 hover:bg-white rounded-full shadow cursor-pointer">
                                    <FiX className="h-3 w-3 text-red-600" />
                                  </button>
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                {ph && ph.url ? (
                                  <img loading="lazy" src={ph.url} alt={ph.filename || 'photo'} className="h-full w-full object-cover" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} />
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
                ) : (
                  <div>
                    {/* Inline result form (replaces modal) */}
                    {showResultModal && selectedPairId ? (
                      <div className="mb-3 p-3 rounded-md bg-gray-50 border border-gray-100">
                        <div className="flex items-center gap-3">
                          <label className="sr-only">Loc</label>
                          <input type="number" aria-label="Loc" placeholder="Loc" value={resultPlace as any} onChange={(e) => setResultPlace(e.target.value === '' ? '' : Number(e.target.value))} className="h-10 w-20 text-center px-2 border border-gray-200 rounded-md bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-200" />
                          <div className="text-sm text-gray-600">/</div>
                          <label className="sr-only">Participanți</label>
                          <input type="number" aria-label="Participanți" placeholder="Participanți" value={resultParticipants as any} onChange={(e) => setResultParticipants(e.target.value === '' ? '' : Number(e.target.value))} className="h-10 w-20 text-center px-2 border border-gray-200 rounded-md bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-200" />
                          <div className="text-sm text-gray-600">-</div>

                          {/* category + button grouped so the + stays inside the parent box and doesn't overlay */}
                          <div className="flex items-center flex-1">
                            <label className="sr-only">Categorie</label>
                            <input type="text" aria-label="Categorie" placeholder="Categorie" value={resultCategory} onChange={(e) => setResultCategory(e.target.value)} className="h-10 px-3 border border-gray-200 rounded-l-md bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 flex-1" />
                            <button type="button" className={`h-10 w-10 flex items-center justify-center rounded-r-md bg-blue-600 text-white hover:bg-blue-700 ${(!canSaveResult || savingResult) ? 'opacity-50 cursor-not-allowed' : ''}`} title="Adaugă" aria-label="Adaugă" disabled={!canSaveResult || savingResult} onClick={async () => {
                              const resObj: ResultFields = {
                                place: resultPlace === '' ? null : Number(resultPlace),
                                participants: resultParticipants === '' ? null : Number(resultParticipants),
                                category: resultCategory || null,
                              }
                              try {
                                setSavingResult(true)
                                await handleSaveResult(selectedPairId, resObj)
                                // after saving, reset inputs so user can add another quickly
                                setResultPlace('')
                                setResultParticipants('')
                                setResultCategory('')
                                setEditingResultId(null)
                                // keep the inline form open for further entries
                              } finally{
                                setSavingResult(false)
                              }
                            }}>
                              <FiPlus className="h-5 w-5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : null}

                    <div className="space-y-2">
                      {selectedPairId && Array.isArray(localEvent.results) && localEvent.results.filter((r: any) => String(r.pairId || '') === String(selectedPairId)).length === 0 && (
                        <div className="text-sm text-gray-500">Nu există rezultate adăugate.</div>
                      )}
                      {selectedPairId && Array.isArray(localEvent.results) && localEvent.results.filter((r: any) => String(r.pairId || '') === String(selectedPairId)).map((res: any) => {
                        const id = String(res._id || res.id || '')
                        return (
                          <div key={id} className="flex items-center justify-between bg-gray-50 p-2 rounded-md">
                            <div className="text-sm">
                              <div className="font-medium">{res.place ?? '—'} / {res.participants ?? '—'} - {res.category || '—'}</div>
                            </div>
                            <div className="flex items-center gap-2">
                              {/* edit/delete kept for non-admins inline: reuse existing permission logic */}
                              {(() => {
                                const sessionUserId = (session as any)?.user?.id
                                const role = String((session as any)?.user?.role || '').toLowerCase()
                                const isAdmin = role.includes('admin') || role.includes('arbitru')
                                const isCreator = String(localEvent.user) === String(sessionUserId)
                                const isResultCreator = String(res.createdBy || '') === String(sessionUserId)
                                const isPairClub = selectedPairObj && String((selectedPairObj as any).club || '') === String(sessionUserId)
                                const canManage = isResultCreator || isCreator || isAdmin || isPairClub
                                return canManage ? (
                                  <>
                                    <button title="Editează" aria-label="Editează" onClick={() => {
                                      // prefill inline form fields and open inline editor
                                      setResultPlace(res.place ?? '')
                                      setResultParticipants(res.participants ?? '')
                                      setResultCategory(res.category || '')
                                      setEditingResultId(id)
                                      setActiveTab('results')
                                      setShowResultModal(true)
                                    }} className="p-2 rounded-md text-gray-700 hover:bg-gray-100">
                                      <FiEdit className="h-4 w-4" />
                                    </button>
                                    <button title="Șterge" aria-label="Șterge" onClick={async () => {
                                      if (!confirm('Ștergeți acest rezultat?')) return
                                      try {
                                        const dres = await fetch(`/api/events/${encodeURIComponent(eventId)}/results?resultId=${encodeURIComponent(id)}`, { method: 'DELETE' })
                                        if (!dres.ok) {
                                          const t = await dres.text().catch(() => '')
                                          alert('Ștergere eșuată: ' + (t || dres.status))
                                          return
                                        }
                                        // refresh
                                        const rr = await fetch(`/api/events/${encodeURIComponent(eventId)}?populate=true`)
                                        if (rr.ok) {
                                          const j = await rr.json()
                                          if (j.event) {
                                            setLocalEvent(j.event)
                                            onUploaded && onUploaded(j.event)
                                          }
                                        }
                                      } catch (err) {
                                        console.error('delete result failed', err)
                                        alert('Ștergere eșuată')
                                      }
                                    }} className="p-2 rounded-md text-red-600 hover:bg-red-50">
                                      <FiTrash2 className="h-4 w-4" />
                                    </button>
                                  </>
                                ) : null
                              })()}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* right: upload control (aligned on same row) - hide when in Results main tab */}
          {mainTab === 'photos' ? (
            <div className="col-span-12 sm:col-span-2 flex items-center justify-end">
              <div>
                {/* hidden file input to open device picker */}
                <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileSelected} className="hidden" />
                <button type="button" onClick={triggerFilePicker} disabled={!selectedPairId || !!uploadingPairId} className={`inline-flex items-center justify-center h-10 px-4 rounded-md text-sm ${uploadingPairId === selectedPairId ? 'bg-gray-200 text-gray-700' : 'bg-blue-600 text-white hover:bg-blue-700'} ${!selectedPairId ? 'opacity-50 cursor-not-allowed' : ''}`}>
                  {uploadingPairId === selectedPairId ? 'Încarcă…' : 'Încarcă'}
                </button>
              </div>
            </div>
          ) : (
            <div className="col-span-12 sm:col-span-2" />
          )}
        </div>
      </div>
    </div>
    
    </>
  )
}