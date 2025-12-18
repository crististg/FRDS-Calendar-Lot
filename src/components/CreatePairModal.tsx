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
  const [p1License, setP1License] = useState('')

  const [p2Name, setP2Name] = useState('')
  const [p2License, setP2License] = useState('')

  const [coach, setCoach] = useState('')
  const [classLevel, setClassLevel] = useState('')
  const [discipline, setDiscipline] = useState('')
  const [ageCategory, setAgeCategory] = useState('')
  // pairCategory and ageCategory are calculated server-side from partner birthdays
  // styles replaced by single-discipline selection
  // const [styles, setStyles] = useState<string[]>([])

  const [p1MinWdsf, setP1MinWdsf] = useState('')
  const [p2MinWdsf, setP2MinWdsf] = useState('')

  useEffect(() => {
    if (!open) {
      setP1Name('')
      setP1License('')
      setP2Name('')
      setP2License('')
      setCoach('')
      setClassLevel('')
      setDiscipline('')
      setAgeCategory('')
      setP1MinWdsf('')
      setP2MinWdsf('')
      // note: no manual category fields to reset
      return
    }

    // if opened with an initial pair, populate fields
    if (initial) {
      setCoach(initial.coach || '')
      setClassLevel(initial.classLevel || '')
      setDiscipline(initial.discipline || (Array.isArray(initial.styles) && initial.styles[0]) || '')
      setAgeCategory(initial.ageCategory || '')
      setP1MinWdsf((initial.partner1 && initial.partner1.minWdsf) || '')
      setP2MinWdsf((initial.partner2 && initial.partner2.minWdsf) || '')
      // partner names and license
      setP1Name((initial.partner1 && (initial.partner1.fullName || initial.partner1Name)) || '')
      // model stores license number as `licenseNumber`
      setP1License((initial.partner1 && (initial.partner1.licenseNumber || initial.partner1.license || '')) || '')
      setP2Name((initial.partner2 && (initial.partner2.fullName || initial.partner2Name)) || '')
      setP2License((initial.partner2 && (initial.partner2.licenseNumber || initial.partner2.license || '')) || '')
    }
  }, [open])

  if (!open) return null

  function toggleStyle(s: string) {
    // noop - styles are now a single discipline (radio)
    setDiscipline(s)
  }

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center transition-opacity ${open ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
      aria-hidden={!open}
    >
      <div className={`absolute inset-0 bg-black/40 transition-opacity ${open ? 'opacity-100' : 'opacity-0'}`} onClick={open ? onClose : undefined} />
      <div className={`relative w-full max-w-2xl bg-white rounded-xl shadow-2xl p-6 transform transition-all mx-4 sm:mx-0 ${open ? 'translate-y-0 scale-100 opacity-100' : 'translate-y-4 scale-95 opacity-0'}`}>
    <h3 className="text-lg font-semibold mb-3">{initial ? 'Editează pereche' : 'Adaugă pereche'}</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <FormInput label="Antrenor" name="coach" value={coach} onChange={(e) => setCoach(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Categorie vârstă</label>
            <select value={ageCategory} onChange={(e) => setAgeCategory(e.target.value)} className="w-full px-4 py-3 rounded-lg border border-gray-200 bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400 shadow-sm">
              <option value="">-- selectați categorie --</option>
              <option>Juvenile 1</option>
              <option>Juvenile 2</option>
              <option>Junior 1</option>
              <option>Junior 2</option>
              <option>Youth</option>
              <option>Under 21</option>
              <option>Adult</option>
              <option>Senior 1</option>
              <option>Senior 2</option>
              <option>Senior 3</option>
              <option>Senior 4</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700">Clasă</label>
            <select value={classLevel} onChange={(e) => setClassLevel(e.target.value)} className="w-full px-4 py-3 rounded-lg border border-gray-200 bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400 shadow-sm">
              <option value="">-- selectați clasa --</option>
              <option>Clasa Hobby</option>
              <option>Clasa E</option>
              <option>Clasa D</option>
              <option>Clasa C</option>
              <option>Clasa B</option>
              <option>Clasa A</option>
              <option>Clasa S</option>
              <option>Clasa Open</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Disciplina</label>
            <div className="flex items-center gap-4 mt-2">
              <label className="inline-flex items-center gap-2"><input type="radio" name="disciplina" checked={discipline === 'Standard'} onChange={() => setDiscipline('Standard')} /> Standard</label>
              <label className="inline-flex items-center gap-2"><input type="radio" name="disciplina" checked={discipline === 'Latin'} onChange={() => setDiscipline('Latin')} /> Latin</label>
              <label className="inline-flex items-center gap-2"><input type="radio" name="disciplina" checked={discipline === 'Ten Dances'} onChange={() => setDiscipline('Ten Dances')} /> Ten Dances</label>
            </div>
          </div>

          

          

          {/* Partner 1 */}
          <div className="col-span-1 md:col-span-1 min-w-0">
            <div className="mb-1">
              <label className="block text-sm font-semibold text-gray-700">Baiat</label>
            </div>
            <FormInput label="" name="p1Name" placeholder="Nume complet" value={p1Name} onChange={(e) => setP1Name(e.target.value)} />
            <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label htmlFor="p1License" className="sr-only">Numar card FRDS</label>
                <input id="p1License" name="p1License" type="text" placeholder="Numar card FRDS" value={p1License} onChange={(e) => setP1License(e.target.value)} className="w-full px-4 py-3 rounded-lg border border-gray-200 bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400 shadow-sm" />
              </div>
              <div>
                <label htmlFor="p1MinWdsf" className="sr-only">MIN WDSF</label>
                <input id="p1MinWdsf" name="p1MinWdsf" type="text" placeholder="MIN WDSF" value={p1MinWdsf} onChange={(e) => setP1MinWdsf(e.target.value)} className="w-full px-4 py-3 rounded-lg border border-gray-200 bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400 shadow-sm" />
              </div>
            </div>
            {/* per-person category removed; use general pairCategory instead */}
          </div>

          {/* Partner 2 */}
          <div className="col-span-1 md:col-span-1 min-w-0">
            <div className="mb-1">
              <label className="block text-sm font-semibold text-gray-700">Fata</label>
            </div>
            <FormInput label="" name="p2Name" placeholder="Nume complet" value={p2Name} onChange={(e) => setP2Name(e.target.value)} />
            <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label htmlFor="p2License" className="sr-only">Numar card FRDS</label>
                <input id="p2License" name="p2License" type="text" placeholder="Numar card FRDS" value={p2License} onChange={(e) => setP2License(e.target.value)} className="w-full px-4 py-3 rounded-lg border border-gray-200 bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400 shadow-sm" />
              </div>
              <div>
                <label htmlFor="p2MinWdsf" className="sr-only">MIN WDSF</label>
                <input id="p2MinWdsf" name="p2MinWdsf" type="text" placeholder="MIN WDSF" value={p2MinWdsf} onChange={(e) => setP2MinWdsf(e.target.value)} className="w-full px-4 py-3 rounded-lg border border-gray-200 bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400 shadow-sm" />
              </div>
            </div>
            {/* per-person category removed; use general pairCategory instead */}
          </div>
        </div>

        <div className="mt-4 flex items-center justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 rounded-md bg-gray-100 text-sm">Anulează</button>
          <button onClick={async () => {
            await onSave({
              _id: initial?._id || initial?.id,
              partner1FullName: p1Name,
              partner1License: p1License,
              partner1MinWdsf: p1MinWdsf || null,
              partner2FullName: p2Name,
              partner2License: p2License,
              partner2MinWdsf: p2MinWdsf || null,
              coach,
              ageCategory: ageCategory || null,
              classLevel,
              discipline: discipline || null,
            })
            onClose()
          }} className="inline-flex items-center justify-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-400">Salvează</button>
        </div>
      </div>
    </div>
  )
}
