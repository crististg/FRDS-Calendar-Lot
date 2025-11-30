import React, { useEffect, useRef, useState } from 'react'
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
  const [resultRound, setResultRound] = useState<string>('')
  const [resultCategory, setResultCategory] = useState<string>('')
  const [resultScore, setResultScore] = useState<number | ''>('')
  const [savingResult, setSavingResult] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [selectedPhotoFiles, setSelectedPhotoFiles] = useState<File[]>([])

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

  type ResultFields = { place?: number | null; round?: string | null; category?: string | null; score?: number | null }

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

  const handleSaveResult = async (pairId: string, result: ResultFields) => {
    try {
      setSavingResult(true)
      const body: any = {}
      if (pairId) body.pairId = pairId
      if (result.place !== undefined && result.place !== null) body.place = Number(result.place)
      if (result.round) body.round = result.round
      if (result.category) body.category = result.category
      if (result.score !== undefined && result.score !== null) body.score = Number(result.score)

      const r2 = await fetch(`/api/events/${encodeURIComponent(eventId)}/results`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      if (!r2.ok) {
        const t = await r2.text().catch(() => '')
        alert('Saving result failed: ' + (t || r2.status))
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
    }
  }

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
                              <div key={String(ph.blobId || ph.url || ph.tempId || ph._id)} className="h-12 w-12 rounded-md overflow-hidden bg-gray-100 shrink-0 border border-gray-100">
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
                    <div className="space-y-2 max-h-36 overflow-auto">
                      {selectedPairId && Array.isArray(localEvent.results) && localEvent.results.filter((r: any) => String(r.pairId || '') === String(selectedPairId)).length === 0 && (
                        <div className="text-sm text-gray-500">Nu există rezultate adăugate.</div>
                      )}
                      {selectedPairId && Array.isArray(localEvent.results) && localEvent.results.filter((r: any) => String(r.pairId || '') === String(selectedPairId)).map((res: any) => {
                        const id = String(res._id || res.id || '')
                        return (
                          <div key={id} className="flex items-center justify-between bg-gray-50 p-2 rounded-md">
                            <div className="text-sm">
                              <div className="font-medium">{res.category || '—'}</div>
                              <div className="text-xs text-gray-500">Loc: {res.place ?? '—'} • Rundă: {res.round || '—'} • Punctaj: {res.score ?? '—'}</div>
                            </div>
                            <div className="flex items-center gap-2">
                              {/* show delete if allowed: creator, event owner, admin/arbitru, or pair's club (client-side guess) */}
                              {(() => {
                                const sessionUserId = (session as any)?.user?.id
                                const role = String((session as any)?.user?.role || '').toLowerCase()
                                const isAdmin = role.includes('admin') || role.includes('arbitru')
                                const isCreator = String(localEvent.user) === String(sessionUserId)
                                const isResultCreator = String(res.createdBy || '') === String(sessionUserId)
                                const isPairClub = selectedPairObj && String((selectedPairObj as any).club || '') === String(sessionUserId)
                                const canDelete = isResultCreator || isCreator || isAdmin || isPairClub
                                return canDelete ? (
                                  <button onClick={async () => {
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
                                  }} className="text-sm text-red-600 px-2 py-1 rounded-md border">Șterge</button>
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

          {/* right: upload control (aligned on same row) */}
          <div className="col-span-12 sm:col-span-2 flex items-center justify-end">
            <div>
              <button type="button" onClick={() => { setActiveTab('results'); setShowResultModal(true) }} disabled={!selectedPairId || !!uploadingPairId} className={`inline-flex items-center justify-center h-10 px-4 rounded-md text-sm ${uploadingPairId === selectedPairId ? 'bg-gray-200 text-gray-700' : 'bg-blue-600 text-white hover:bg-blue-700'} ${!selectedPairId ? 'opacity-50 cursor-not-allowed' : ''}`}>
                {uploadingPairId === selectedPairId ? 'Încarcă…' : 'Încarcă'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
    {/* Metadata modal (nested) */}
    {showResultModal && selectedPairId ? (
      <div className="fixed inset-0 z-60 flex items-center justify-center">
        <div className="absolute inset-0 bg-black/50" onClick={() => setShowResultModal(false)} />
        <div className="relative w-full max-w-md bg-white rounded-lg shadow-lg p-6 z-10">
          <div className="flex items-center justify-between">
            <h4 className="text-md font-semibold">Adaugă rezultat și/sau fotografie</h4>
            <button className="text-gray-500" onClick={() => setShowResultModal(false)}>✕</button>
          </div>

          {/* tabs */}
            <div className="mt-3">
            <div className="flex gap-4 items-center justify-start pb-2">
              <button type="button" onClick={() => setActiveTab('results')} className={`px-3 py-1 rounded-t-md border-b-2 ${activeTab === 'results' ? 'border-gray-300 text-gray-900' : 'border-transparent text-gray-600 hover:text-gray-800'}`}>Rezultate</button>
              <button type="button" onClick={() => setActiveTab('photos')} className={`px-3 py-1 rounded-t-md border-b-2 ${activeTab === 'photos' ? 'border-gray-300 text-gray-900' : 'border-transparent text-gray-600 hover:text-gray-800'}`}>Fotografii</button>
            </div>

            <div className="mt-3">
              {activeTab === 'results' ? (
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm text-gray-700">Loc (număr)</label>
                    <input type="number" placeholder="Ex: 1" value={resultPlace as any} onChange={(e) => setResultPlace(e.target.value === '' ? '' : Number(e.target.value))} className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-200" />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-700">Rundă</label>
                    <input type="text" placeholder="Ex: Finală" value={resultRound} onChange={(e) => setResultRound(e.target.value)} className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-200" />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-700">Categorie</label>
                    <input type="text" placeholder="Ex: Open - Adulți - Standard" value={resultCategory} onChange={(e) => setResultCategory(e.target.value)} className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-200" />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-700">Punctaj</label>
                    <input type="number" placeholder="Ex: 95.5" value={resultScore as any} onChange={(e) => setResultScore(e.target.value === '' ? '' : Number(e.target.value))} className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-200" />
                  </div>

                  <div className="flex justify-end gap-2">
                    <button type="button" onClick={() => setShowResultModal(false)} className="px-3 py-1 rounded-md border">Închide</button>
                    <button type="button" disabled={savingResult} onClick={async () => {
                      const resObj: ResultFields = {
                        place: resultPlace === '' ? null : Number(resultPlace),
                        round: resultRound || null,
                        category: resultCategory || null,
                        score: resultScore === '' ? null : Number(resultScore),
                      }
                      await handleSaveResult(selectedPairId, resObj)
                      setShowResultModal(false)
                      setResultPlace('')
                      setResultRound('')
                      setResultCategory('')
                      setResultScore('')
                    }} className="px-3 py-1 rounded-md bg-blue-600 text-white">Salvează rezultat</button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm text-gray-700">Alege fotografie</label>
                    <input ref={fileInputRef} id={`pair-file-photo-${selectedPairId}`} type="file" accept="image/*" multiple className="hidden" onChange={(e) => {
                      const files = Array.from((e.target as HTMLInputElement).files || [])
                      setSelectedPhotoFiles(files)
                    }} />

                    <div className="mt-2 flex items-center gap-2">
                      <button type="button" onClick={() => fileInputRef.current?.click()} className="px-3 py-1 rounded-md border">Browse…</button>
                      <div className="text-sm text-gray-700 truncate">{selectedPhotoFiles.length > 0 ? `${selectedPhotoFiles.length} file(s) selected` : 'No file selected.'}</div>
                    </div>
                  </div>
                  <div className="text-sm text-gray-500">Poți adăuga fotografii fără a crea un rezultat sau comuta la tabul Rezultate pentru a salva și un rezultat.</div>
                  <div className="flex justify-end gap-2">
                    <button type="button" onClick={() => setShowResultModal(false)} className="px-3 py-1 rounded-md border">Închide</button>
                    <button type="button" disabled={selectedPhotoFiles.length === 0 || !!uploadingPairId} onClick={async () => {
                      if (selectedPhotoFiles.length === 0) return
                      try {
                        // upload files sequentially
                        for (const f of selectedPhotoFiles) {
                          try {
                            await handleUploadPhoto(selectedPairId, f)
                          } catch (err) {
                            // continue with next file
                            console.error('one file upload failed', err)
                          }
                        }
                      } finally {
                        setSelectedPhotoFiles([])
                        if (fileInputRef.current) fileInputRef.current.value = ''
                      }
                    }} className={`px-3 py-1 rounded-md ${selectedPhotoFiles.length === 0 ? 'opacity-50 cursor-not-allowed' : 'bg-blue-600 text-white'}`}>Încarcă</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    ) : null}
    </>
  )
}