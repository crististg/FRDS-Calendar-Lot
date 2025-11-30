import React, { useState, useEffect } from 'react'
import FormInput from './FormInput'

type Props = {
  open: boolean
  onClose: () => void
  onSave: (payload: any) => Promise<void> | void
}

type InitialPair = any

export default function CreatePairModal({ open, onClose, onSave, initial }: Props & { initial?: InitialPair }) {
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
      return
    }

    // if opened with an initial pair, populate fields
    if (initial) {
      setCoach(initial.coach || '')
      setClassLevel(initial.classLevel || '')
      setStyles(Array.isArray(initial.styles) ? initial.styles : [])
      // helper to format date to yyyy-mm-dd for <input type=date>
      const fmt = (v: any) => {
        if (!v) return ''
        const d = new Date(v)
        if (isNaN(d.getTime())) return ''
        return d.toISOString().slice(0, 10)
      }
      // partner names and birthdays
      setP1Name((initial.partner1 && (initial.partner1.fullName || initial.partner1Name)) || '')
      setP1Birthday((initial.partner1 && (initial.partner1.birthday ? fmt(initial.partner1.birthday) : '')) || '')
      // model stores license number as `licenseNumber`
      setP1License((initial.partner1 && (initial.partner1.licenseNumber || initial.partner1.license || '')) || '')
      setP2Name((initial.partner2 && (initial.partner2.fullName || initial.partner2Name)) || '')
      setP2Birthday((initial.partner2 && (initial.partner2.birthday ? fmt(initial.partner2.birthday) : '')) || '')
      setP2License((initial.partner2 && (initial.partner2.licenseNumber || initial.partner2.license || '')) || '')
    }
  }, [open])

  if (!open) return null

  function toggleStyle(s: string) {
    setStyles((prev) => prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s])
  }

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center transition-opacity ${open ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
      aria-hidden={!open}
    >
      <div className={`absolute inset-0 bg-black/40 transition-opacity ${open ? 'opacity-100' : 'opacity-0'}`} onClick={open ? onClose : undefined} />
      <div className={`relative w-full max-w-2xl bg-white rounded-xl shadow-2xl p-6 transform transition-all ${open ? 'translate-y-0 scale-100 opacity-100' : 'translate-y-4 scale-95 opacity-0'}`}>
    <h3 className="text-lg font-semibold mb-3">{initial ? 'Editează pereche' : 'Adaugă pereche'}</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <FormInput label="Antrenor" name="coach" value={coach} onChange={(e) => setCoach(e.target.value)} />
          </div>

          <div>
            <FormInput label="Clasă" name="classLevel" value={classLevel} onChange={(e) => setClassLevel(e.target.value)} />
          </div>

          {/* pairCategory and ageCategory are computed automatically from partner birthdays - no manual input */}

          {/* Partner 1 */}
          <div className="col-span-1 md:col-span-1">
            <div className="mb-1">
              <label className="block text-sm font-semibold text-gray-700">Partener 1</label>
            </div>
            <FormInput label="" name="p1Name" placeholder="Nume complet" value={p1Name} onChange={(e) => setP1Name(e.target.value)} />
            <div className="mt-2 grid grid-cols-2 gap-2">
              <FormInput label="" name="p1Birthday" type="date" value={p1Birthday} onChange={(e) => setP1Birthday(e.target.value)} />
              <FormInput label="" name="p1License" placeholder="Număr licență" value={p1License} onChange={(e) => setP1License(e.target.value)} />
            </div>
            {/* per-person category removed; use general pairCategory instead */}
          </div>

          {/* Partner 2 */}
          <div className="col-span-1 md:col-span-1">
            <div className="mb-1">
              <label className="block text-sm font-semibold text-gray-700">Partener 2</label>
            </div>
            <FormInput label="" name="p2Name" placeholder="Nume complet" value={p2Name} onChange={(e) => setP2Name(e.target.value)} />
            <div className="mt-2 grid grid-cols-2 gap-2">
              <FormInput label="" name="p2Birthday" type="date" value={p2Birthday} onChange={(e) => setP2Birthday(e.target.value)} />
              <FormInput label="" name="p2License" placeholder="Număr licență" value={p2License} onChange={(e) => setP2License(e.target.value)} />
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

        <div className="mt-4 flex items-center justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 rounded-md bg-gray-100 text-sm">Anulează</button>
          <button onClick={async () => {
            await onSave({
              _id: initial?._id || initial?.id,
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
          }} className="inline-flex items-center justify-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-400">Salvează</button>
        </div>
      </div>
    </div>
  )
}
