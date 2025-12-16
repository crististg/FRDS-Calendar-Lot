import React, { useState } from 'react'

type Props = {
  open: boolean
  event: any | null
  onClose: () => void
  onSubmitted?: () => void
}

export default function SolicitationModal({ open, event, onClose, onSubmitted }: Props) {
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!open || !event) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/solicitations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId: event._id || event.id,
          message,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.error || 'Eroare la trimitere solicitării')
        return
      }

      // Success
      setMessage('')
      onClose()
      onSubmitted?.()
    } catch (err) {
      console.error('Failed to submit solicitation', err)
      setError('Eroare de rețea')
    } finally {
      setLoading(false)
    }
  }

  const eventTitle = event.title || 'Event'
  const eventDate = event.start ? new Date(event.start).toLocaleDateString('ro-RO') : 'Data necunoscută'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white rounded-xl shadow-2xl p-6 z-60 mx-4">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold">Cere Participare</h3>
            <p className="text-sm text-gray-500">Solicită să participi la acest eveniment</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
          <div className="text-sm font-medium text-blue-900">{eventTitle}</div>
          <div className="text-xs text-blue-700 mt-1">{eventDate}</div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Mesaj (opțional)
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Spune-ne de ce doriți să participați..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={3}
            />
          </div>

          {error && (
            <div className="text-sm text-red-600 bg-red-50 p-2 rounded">
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 disabled:opacity-50 rounded-lg text-sm font-medium"
            >
              Anulează
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium"
            >
              {loading ? 'Se trimite...' : 'Trimite Cerere'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
