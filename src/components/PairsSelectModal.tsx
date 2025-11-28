import React, { useEffect, useState } from 'react'

type Props = {
  open: boolean
  initialSelected?: string[]
  onClose: () => void
  onSave: (selectedIds: string[]) => void | Promise<void>
}

export default function PairsSelectModal({ open, initialSelected = [], onClose, onSave }: Props) {
  const [pairs, setPairs] = useState<any[] | null>(null)
  const [selected, setSelected] = useState<string[]>(initialSelected || [])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open) return
    setSelected(initialSelected || [])
    setPairs(null)
    setLoading(true)
    let mounted = true
    fetch('/api/pairs')
      .then((r) => r.ok ? r.json() : Promise.reject(r))
      .then((d) => { if (!mounted) return; setPairs(Array.isArray(d.pairs) ? d.pairs : [] ) })
      .catch((e) => { console.error('Failed to load pairs', e); if (mounted) setPairs([]) })
      .finally(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }, [open])

  function toggle(id: string) {
    setSelected((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-lg shadow-lg w-full max-w-md mx-4 sm:mx-0 p-4 sm:p-6 z-60 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between mb-2 pb-2 border-b border-gray-100">
          <div>
            <h3 className="text-lg font-semibold">Selectează perechile</h3>
            <div className="text-xs text-gray-500">Alege una sau mai multe perechi din clubul tău pentru a participa la eveniment.</div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-2 rounded-md">✕</button>
        </div>

        {/* Content: scrollable list */}
        {loading && <div className="text-sm text-gray-500">Se încarcă...</div>}
        {!loading && pairs && pairs.length === 0 && <div className="text-sm text-gray-500">Nu aveți perechi înregistrate.</div>}

        <div className="flex-1 overflow-auto py-2">
          <div className="space-y-2">
            {(pairs || []).map((p) => {
              const id = p._id || p.id
              const label = `${(p.partner1 && p.partner1.fullName) || ''}${(p.partner2 && p.partner2.fullName) ? ` / ${(p.partner2 && p.partner2.fullName)}` : ''}`
              const subtitle = p.pairCategory || p.classLevel || p.coach || ''
              return (
                <label key={id} className="flex items-start sm:items-center gap-3 px-3 py-3 rounded-md hover:bg-gray-50 cursor-pointer">
                  <input aria-label={`Select pair ${label}`} type="checkbox" checked={selected.includes(String(id))} onChange={() => toggle(String(id))} className="h-5 w-5 mt-1 sm:mt-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{label || 'Pereche'}</div>
                    {subtitle && <div className="text-xs text-gray-500 truncate">{subtitle}</div>}
                  </div>
                </label>
              )
            })}
          </div>
        </div>

        {/* Footer actions */}
        <div className="mt-3 pt-3 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-end gap-2">
          <button onClick={onClose} className="w-full sm:w-auto px-3 py-3 rounded-md bg-gray-100">Anulează</button>
          <button onClick={async () => { await onSave(selected); onClose() }} className="w-full sm:w-auto px-3 py-3 rounded-md bg-blue-600 text-white">Selectează</button>
        </div>
      </div>
    </div>
  )
}
