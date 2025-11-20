import React, { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'

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

  if (!open || !local) return null

  const s = local.start ? new Date(local.start) : null
  const e = local.end ? new Date(local.end) : null
  const timeLabel = local.allDay ? 'Toată ziua' : (e ? `${s?.toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' })} - ${e?.toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' })}` : s?.toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' }))

  const attendees = Array.isArray(local.attendees) ? local.attendees : []
  const isAttending = Boolean(userId && attendees.some((a: any) => String(a._id || a) === String(userId)))

  const handleToggle = async () => {
    if (!local || !local._id) return
    const id = local._id || local.id

    // optimistic
    setLocal((prev: any) => {
      if (!prev) return prev
      const at = Array.isArray(prev.attendees) ? [...prev.attendees] : []
      if (isAttending) {
        return { ...prev, attendees: at.filter((a: any) => String(a._id || a) !== String(userId)) }
      }
      return { ...prev, attendees: [...at, { _id: userId }] }
    })

    try {
      const method = isAttending ? 'DELETE' : 'POST'
      const res = await fetch(`/api/events/${encodeURIComponent(id)}/attend`, { method })
      if (!res.ok) {
        // revert: refetch event
        const r2 = await fetch(`/api/events/${encodeURIComponent(id)}?populate=true`)
        if (r2.ok) {
          const d = await r2.json()
          setLocal(d.event || null)
          onUpdated && onUpdated(d.event)
        }
        const data = await res.json().catch(() => ({}))
        alert('Eroare la actualizare participare: ' + (data.message || res.status))
      } else {
        const data = await res.json().catch(() => ({}))
        // attempt to use returned event if present
        const updated = data && data.event ? data.event : null
        if (updated) {
          setLocal(updated)
          onUpdated && onUpdated(updated)
        }
      }
    } catch (err) {
      console.error('Toggle attend failed', err)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-white rounded-xl shadow-2xl p-6">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-lg font-semibold">{local.title}</h3>
            <p className="text-sm text-gray-500">{s ? s.toLocaleDateString('ro-RO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : ''}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>

        <div className="mt-4 space-y-3">
          <div className="text-sm text-gray-700"><strong>Ora:</strong> {timeLabel}</div>
          <div className="text-sm text-gray-700"><strong>Locație:</strong> {local.location || '-'}</div>
          <div className="text-sm text-gray-700"><strong>Descriere:</strong></div>
          <div className="text-sm text-gray-600 whitespace-pre-wrap">{local.description || '-'}</div>

          <div className="pt-3">
            <div className="text-sm text-gray-700"><strong>Adăugat de:</strong> {local.user ? (local.user.fullName || [local.user.firstName, local.user.lastName].filter(Boolean).join(' ') || local.user.email) : '-'}</div>
            {local.user?.role && <div className="text-sm text-gray-500">Rol: {local.user.role}</div>}
          </div>
        </div>

        <div className="mt-6 flex items-center justify-end gap-3">
          {userId ? (
            <button onClick={handleToggle} className={`px-4 py-2 rounded-md text-sm ${isAttending ? 'bg-red-50 text-red-600' : 'bg-blue-600 text-white'}`}>
              {isAttending ? 'Renunță' : 'Participă'}
            </button>
          ) : (
            <div className="text-xs text-gray-400">Autentificați-vă pentru a participa</div>
          )}
          <button onClick={onClose} className="px-3 py-2 rounded-md hover:bg-gray-100">Închide</button>
        </div>
      </div>
    </div>
  )
}
