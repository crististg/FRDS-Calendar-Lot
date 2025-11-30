import React, { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import PairsSelectModal from './PairsSelectModal'

type Props = {
  open: boolean
  event: any | null
  onClose: () => void
  onUpdated?: (updated: any) => void
}

export default function EventModal({ open, event, onClose, onUpdated }: Props) {
  const { data: session } = useSession()
  const userId = (session as any)?.user?.id

  const [local, setLocal] = useState<any | null>(null)
  useEffect(() => {
    setLocal(event ? { ...event } : null)
  }, [event])

  // keep hooks at top-level: modal open state and upload state
  const [openPairsModal, setOpenPairsModal] = useState(false)
  const [uploadingPairId, setUploadingPairId] = useState<string | null>(null)
  const [showMyPairsList, setShowMyPairsList] = useState<boolean>(false)

  if (!open || !local) return null

  const s = local.start ? new Date(local.start) : null
  const e = local.end ? new Date(local.end) : null
  const timeLabel = local.allDay ? 'Toată ziua' : (e ? `${s?.toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' })} - ${e?.toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' })}` : s?.toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' }))

  const attendingPairs = Array.isArray(local.attendingPairs) ? local.attendingPairs : []
  const role = (session as any)?.user?.role
  const isClub = String(role || '').toLowerCase() === 'club'

  // myPairs: pairs owned by current logged-in user (helps when role isn't present or mismatched)
  const myPairs = (attendingPairs || []).filter((p: any) => String(p.club || p) === String(userId))
  const showMyPairsPanel = isClub || (myPairs && myPairs.length > 0)

  // Non-club user-level attendance is removed; clubs register pairs via the pairs modal.

  const handleOpenPairs = async () => {
    // ensure we have latest event with populated attendingPairs
    if (!local || !local._id) return
    try {
      const res = await fetch(`/api/events/${encodeURIComponent(local._id || local.id)}?populate=true`)
      if (res.ok) {
        const d = await res.json()
        if (d.event) setLocal(d.event)
      }
    } catch (err) {
      console.error('Failed to refresh event before opening pairs modal', err)
    }
    setOpenPairsModal(true)
  }

  const handleSavePairs = async (selectedIds: string[]) => {
    if (!local || !local._id) return
    const id = local._id || local.id
    const existing = (local.attendingPairs || []).map((p: any) => String(p._id || p))
    const toAdd = selectedIds.filter((s) => !existing.includes(String(s)))
    const toRemove = existing.filter((e: string) => !selectedIds.includes(String(e)))

    // optimistic
    setLocal((prev: any) => prev ? { ...prev, attendingPairs: selectedIds.map((sid) => ({ _id: sid })) } : prev)

    try {
      if (toAdd.length) {
        await fetch(`/api/events/${encodeURIComponent(id)}/attend`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pairIds: toAdd }) })
      }
      if (toRemove.length) {
        await fetch(`/api/events/${encodeURIComponent(id)}/attend`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pairIds: toRemove }) })
      }

      // refresh event
      const r2 = await fetch(`/api/events/${encodeURIComponent(id)}?populate=true`)
      if (r2.ok) {
        const d2 = await r2.json()
        if (d2.event) {
          setLocal(d2.event)
          onUpdated && onUpdated(d2.event)
        }
      }
    } catch (err) {
      console.error('Failed to update pairs attendance', err)
    }
  }

  return (
    <div className="fixed inset-0 z-99999 flex items-center justify-center">
      <div className="absolute inset-0 z-99998 bg-black/40" onClick={onClose} />
      <div className="relative z-99999 w-full max-w-lg bg-white rounded-xl shadow-2xl p-6">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-lg font-semibold">{local.title}</h3>
            <p className="text-sm text-gray-500">{s ? s.toLocaleDateString('ro-RO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : ''}</p>
          </div>
          <div className="flex items-center gap-2">
            {showMyPairsPanel && (
              <button onClick={async () => {
                if (!showMyPairsList) await handleOpenPairs()
                setShowMyPairsList((v) => !v)
              }} className="px-3 py-1 rounded-md text-sm bg-gray-50 text-gray-700">Perechile mele ({myPairs.length})</button>
            )}
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
          </div>
        </div>

        <div className="mt-4 space-y-3">
          <div className="text-sm text-gray-700"><strong>Ora:</strong> {timeLabel}</div>
          <div className="text-sm text-gray-700"><strong>Locație:</strong> {([local.address, local.city, local.country].filter(Boolean).join(', ') ) || '-'}</div>
          <div className="text-sm text-gray-700"><strong>Descriere:</strong></div>
          <div className="text-sm text-gray-600 whitespace-pre-wrap">{local.description || '-'}</div>

          <div className="pt-3">
            <div className="text-sm text-gray-700"><strong>Adăugat de:</strong> {local.user ? (local.user.fullName || [local.user.firstName, local.user.lastName].filter(Boolean).join(' ') || local.user.email) : '-'}</div>
            {local.user?.role && <div className="text-sm text-gray-500">Rol: {local.user.role}</div>}
          </div>
        </div>

        {/* Club: show a toggleable panel of my pairs that are participating, with upload + unattend buttons */}
        {showMyPairsPanel && (
          <div className="mt-4">
            <div className={`${showMyPairsList ? '' : 'hidden'} mt-2 flex flex-col gap-2`}>
              {myPairs.length === 0 ? (
                <div className="text-sm text-gray-500 px-3 py-2">Nu aveți perechi înscrise pentru acest eveniment.</div>
              ) : (
                myPairs.map((p: any) => {
                  const pid = String(p._id || p)
                  const name1 = (p.partner1 && p.partner1.fullName) || ''
                  const name2 = (p.partner2 && p.partner2.fullName) || ''
                  const label = `${name1}${name2 ? ` / ${name2}` : ''}`
                  return (
                    <div key={pid} className="flex items-center justify-between gap-3 px-3 py-2 bg-white rounded-md">
                      <div className="text-sm truncate">{label}</div>
                      <div className="flex items-center gap-2">
                        <button onClick={async () => {
                          if (!confirm('Renunțați la această pereche pentru eveniment?')) return
                          const id = local._id || local.id
                          try {
                            setLocal((prev: any) => {
                              if (!prev) return prev
                              const next = { ...prev }
                              next.attendingPairs = (next.attendingPairs || []).filter((pp: any) => String(pp._id || pp) !== String(pid))
                              return next
                            })
                            await fetch(`/api/events/${encodeURIComponent(id)}/attend`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pairIds: [pid] }) })
                          } catch (err) {
                            console.error('Failed to unattend pair', err)
                          }
                        }} className="px-3 py-1 rounded-md text-sm bg-red-50 text-red-600">Renunță</button>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        )}

        <div className="mt-6 flex items-center justify-end gap-3">
          {userId ? (
            isClub ? (
              <>
                <button onClick={handleOpenPairs} className={`px-4 py-2 rounded-md text-sm ${attendingPairs && attendingPairs.length ? 'bg-red-50 text-red-600' : 'bg-blue-600 text-white'}`}>
                  {(attendingPairs && attendingPairs.length) ? 'Gestionează participarea' : 'Participă cu pereche'}
                </button>
                <PairsSelectModal open={openPairsModal} initialSelected={(attendingPairs || []).map((p: any) => String(p._id || p))} onClose={() => setOpenPairsModal(false)} onSave={handleSavePairs} />
              </>
            ) : (
              <button disabled className="px-4 py-2 rounded-md text-sm bg-gray-100 text-gray-500" title="Participarea se face prin club/pereche">Participă</button>
            )
          ) : (
            <div className="text-xs text-gray-400">Autentificați-vă pentru a participa</div>
          )}
          <button onClick={onClose} className="px-3 py-2 rounded-md hover:bg-gray-100">Închide</button>
        </div>
      </div>
    </div>
  )
}
