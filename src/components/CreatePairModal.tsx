import React, { useState, useEffect } from 'react'

type Props = {
  open: boolean
  onClose: () => void
  onSave: (payload: any) => Promise<void> | void
}

export default function CreatePairModal({ open, onClose, onSave }: Props) {
  const [p1Name, setP1Name] = useState('')
  const [p1Birthday, setP1Birthday] = useState('')
  const [p1License, setP1License] = useState('')

  const [p2Name, setP2Name] = useState('')
  const [p2Birthday, setP2Birthday] = useState('')
  const [p2License, setP2License] = useState('')

  const [coach, setCoach] = useState('')
  const [classLevel, setClassLevel] = useState('')
  // pairCategory and ageCategory are calculated server-side from partner birthdays
  const [styles, setStyles] = useState<string[]>([])

  useEffect(() => {
    if (!open) {
      setP1Name('')
      setP1Birthday('')
      setP1License('')
      setP2Name('')
      setP2Birthday('')
      setP2License('')
      setCoach('')
      setClassLevel('')
      setStyles([])
      // note: no manual category fields to reset
    }
  }, [open])

  if (!open) return null

  function toggleStyle(s: string) {
    setStyles((prev) => prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s])
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-lg shadow-lg w-11/12 max-w-2xl p-6">
        <h3 className="text-lg font-semibold mb-3">Adaugă pereche</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm text-gray-700">Antrenor</label>
            <input value={coach} onChange={(e) => setCoach(e.target.value)} className="w-full mt-1 px-3 py-2 border rounded-md" />
          </div>


          <div>
            <label className="block text-sm text-gray-700">Clasă</label>
            <input value={classLevel} onChange={(e) => setClassLevel(e.target.value)} className="w-full mt-1 px-3 py-2 border rounded-md" />
          </div>

          {/* pairCategory and ageCategory are computed automatically from partner birthdays - no manual input */}

          {/* Partner 1 */}
          <div className="col-span-1 md:col-span-1">
            <label className="block text-sm font-semibold text-gray-700">Partener 1</label>
            <input placeholder="Nume complet" value={p1Name} onChange={(e) => setP1Name(e.target.value)} className="w-full mt-1 px-3 py-2 border rounded-md" />
            <div className="mt-2 grid grid-cols-2 gap-2">
              <input type="date" value={p1Birthday} onChange={(e) => setP1Birthday(e.target.value)} className="w-full px-3 py-2 border rounded-md" />
              <input placeholder="Număr licență" value={p1License} onChange={(e) => setP1License(e.target.value)} className="w-full px-3 py-2 border rounded-md" />
            </div>
            {/* per-person category removed; use general pairCategory instead */}
          </div>

          {/* Partner 2 */}
          <div className="col-span-1 md:col-span-1">
            <label className="block text-sm font-semibold text-gray-700">Partener 2</label>
            <input placeholder="Nume complet" value={p2Name} onChange={(e) => setP2Name(e.target.value)} className="w-full mt-1 px-3 py-2 border rounded-md" />
            <div className="mt-2 grid grid-cols-2 gap-2">
              <input type="date" value={p2Birthday} onChange={(e) => setP2Birthday(e.target.value)} className="w-full px-3 py-2 border rounded-md" />
              <input placeholder="Număr licență" value={p2License} onChange={(e) => setP2License(e.target.value)} className="w-full px-3 py-2 border rounded-md" />
            </div>
            {/* per-person category removed; use general pairCategory instead */}
          </div>

          <div className="col-span-1 md:col-span-2">
            <label className="block text-sm font-medium text-gray-700">Stiluri</label>
            <div className="flex items-center gap-4 mt-2">
              <label className="inline-flex items-center gap-2"><input type="checkbox" checked={styles.includes('Latin')} onChange={() => toggleStyle('Latin')} /> Latin</label>
              <label className="inline-flex items-center gap-2"><input type="checkbox" checked={styles.includes('Standard')} onChange={() => toggleStyle('Standard')} /> Standard</label>
            </div>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-end gap-2">
          <button onClick={onClose} className="px-3 py-1 rounded-md bg-gray-100">Anulează</button>
          <button onClick={async () => {
            await onSave({
              partner1FullName: p1Name,
              partner1Birthday: p1Birthday || null,
              partner1License: p1License,
              partner2FullName: p2Name,
              partner2Birthday: p2Birthday || null,
              partner2License: p2License,
              coach,
              // ageCategory and pairCategory omitted - server will compute
              classLevel,
              styles,
            })
            onClose()
          }} className="px-3 py-1 rounded-md bg-blue-600 text-white">Salvează</button>
        </div>
      </div>
    </div>
  )
}
