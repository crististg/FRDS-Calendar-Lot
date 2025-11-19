import React from 'react'

type Props = {
  open: boolean
  date: Date | null
  onClose: () => void
  onCreate?: (date: Date | null) => void
}

export default function DayModal({ open, date, onClose, onCreate }: Props) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white rounded-xl shadow-2xl p-6">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-lg font-semibold">{date ? date.toLocaleDateString('ro-RO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : 'Zi selectată'}</h3>
            <p className="text-sm text-gray-500">Evenimente planificate pentru această zi</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>

        <div className="mt-4 space-y-3">
          {/* demo events list; replace with real data */}
          <div className="flex items-start gap-3">
            <span className="h-2 w-2 rounded-full bg-blue-600 mt-2" />
            <div>
              <div className="text-sm font-medium">Eveniment demo</div>
              <div className="text-xs text-gray-500">Ora: 10:00</div>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <span className="h-2 w-2 rounded-full bg-blue-600 mt-2" />
            <div>
              <div className="text-sm font-medium">Repetiție</div>
              <div className="text-xs text-gray-500">Ora: 18:30</div>
            </div>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-end gap-3">
          <button onClick={onClose} className="px-3 py-2 rounded-md hover:bg-gray-100">Închide</button>
          <button onClick={() => onCreate && onCreate(date)} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md">Creează eveniment</button>
        </div>
      </div>
    </div>
  )
}
