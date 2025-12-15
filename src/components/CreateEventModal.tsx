import React, { useState, useEffect } from 'react'

type Props = {
  open: boolean
  date: Date | null
  onClose: () => void
  // initial - optional event to prefill the form when editing
  initial?: {
    _id?: string
    title?: string
    description?: string
    eventType?: 'WDSF' | 'Open' | 'Invitational'
    country?: string
    city?: string
    address?: string
    allDay?: boolean
    start?: string | Date | null
    end?: string | Date | null
  }
  onSave: (payload: { date: Date | null; startDate?: string | null; endDate?: string | null; title: string; description?: string; time?: string | null; startTime?: string | null; endTime?: string | null; allDay?: boolean; country?: string | null; city?: string | null; address?: string | null; eventType?: 'WDSF' | 'Open' | 'Invitational' }) => void
}

export default function CreateEventModal({ open, date, onClose, initial, onSave }: Props) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [startDateValue, setStartDateValue] = useState(() => {
    if (!date) return ''
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, '0')
    const d = String(date.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  })
  const [endDateValue, setEndDateValue] = useState<string>(() => '')
  // dates only: no time selection (all-day events)
  const [country, setCountry] = useState('')
  const [city, setCity] = useState('')
  const [address, setAddress] = useState('')
  const [eventType, setEventType] = useState<'WDSF' | 'Open' | 'Invitational'>('Open')

  // Sync dateValue when opening the modal or when the date prop changes
  useEffect(() => {
    if (!open) return
    // If initial event is provided (editing), prefill fields from it
    if ((initial as any) && (initial as any).title !== undefined) {
      const init = initial as any
      setTitle(init.title || '')
      setDescription(init.description || '')
      setEventType(init.eventType || 'Open')
      setCountry(init.country || '')
      setCity(init.city || '')
      setAddress(init.address || '')

      const start = init.start ? new Date(init.start) : null
      const end = init.end ? new Date(init.end) : null
      if (start) {
        const y = start.getFullYear()
        const m = String(start.getMonth() + 1).padStart(2, '0')
        const d = String(start.getDate()).padStart(2, '0')
        setStartDateValue(`${y}-${m}-${d}`)
      } else if (date) {
        const y = date.getFullYear()
        const m = String(date.getMonth() + 1).padStart(2, '0')
        const d = String(date.getDate()).padStart(2, '0')
        setStartDateValue(`${y}-${m}-${d}`)
      } else {
        setStartDateValue('')
      }

      if (end) {
        const y2 = end.getFullYear()
        const m2 = String(end.getMonth() + 1).padStart(2, '0')
        const d2 = String(end.getDate()).padStart(2, '0')
        setEndDateValue(`${y2}-${m2}-${d2}`)
      } else {
        setEndDateValue('')
      }
      return
    }

    if (date) {
      const y = date.getFullYear()
      const m = String(date.getMonth() + 1).padStart(2, '0')
      const d = String(date.getDate()).padStart(2, '0')
      setStartDateValue(`${y}-${m}-${d}`)
      setEndDateValue('')
    } else {
      setStartDateValue('')
      setEndDateValue('')
    }
  }, [open, date, initial])

  if (!open) return null

  function submit(e: React.FormEvent) {
    e.preventDefault()
    // Build a date-only start (00:00) and optional end (23:59:59) for multi-day events
    let payloadDate: Date | null = null
    if (startDateValue) {
      const [yyyy, mm, dd] = startDateValue.split('-').map((s) => parseInt(s, 10))
      if (!Number.isNaN(yyyy) && !Number.isNaN(mm) && !Number.isNaN(dd)) {
        payloadDate = new Date(yyyy, mm - 1, dd, 0, 0, 0)
      } else {
        payloadDate = date
      }
    } else {
      payloadDate = date
    }

    let payloadEnd: Date | undefined = undefined
    if (endDateValue) {
      const [y2, m2, d2] = endDateValue.split('-').map((s) => parseInt(s, 10))
      if (!Number.isNaN(y2) && !Number.isNaN(m2) && !Number.isNaN(d2)) {
        // set end to end of day
        payloadEnd = new Date(y2, m2 - 1, d2, 23, 59, 59)
      }
    }

  onSave({ date: payloadDate, startDate: startDateValue || null, endDate: endDateValue || null, title, description, allDay: true, country: country || null, city: city || null, address: address || null, eventType })
    setTitle('')
    setDescription('')
    setCountry('')
    setCity('')
    setAddress('')
    setStartDateValue('')
    setEndDateValue('')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-white rounded-xl shadow-2xl p-6 max-h-[90vh] flex flex-col">
        <div className="overflow-y-auto">
          <h3 className="text-xl font-semibold mb-2">{initial ? 'Editează eveniment' : 'Creează eveniment'}</h3>
          <p className="text-sm text-gray-500 mb-4">Data: {startDateValue || (date ? date.toLocaleDateString('ro-RO') : '-')}{endDateValue ? ` — ${endDateValue}` : ''}</p>

          <form id="create-event-form" onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Titlu</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-200" placeholder="Nume eveniment" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Categorie</label>
            <select value={eventType} onChange={(e) => setEventType(e.target.value as any)} className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-md bg-white">
              <option value="WDSF">WDSF</option>
              <option value="Open">Open</option>
              <option value="Invitational">Invitational</option>
            </select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700">Data (început)</label>
              <input type="date" value={startDateValue} onChange={(e) => setStartDateValue(e.target.value)} className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-md" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Data (sfârșitul) — opțional</label>
              <input type="date" value={endDateValue} onChange={(e) => setEndDateValue(e.target.value)} className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-md" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          

            <div>
              <label className="block text-sm font-medium text-gray-700">Țară</label>
              <input value={country} onChange={(e) => setCountry(e.target.value)} className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-md" placeholder="Ex: România" />
            </div>

            

            <div>
              <label className="block text-sm font-medium text-gray-700">Oraș</label>
              <input value={city} onChange={(e) => setCity(e.target.value)} className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-md" placeholder="Ex: București" />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700">Adresă</label>
              <input value={address} onChange={(e) => setAddress(e.target.value)} className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-md" placeholder="Stradă, număr, etc. (opțional)" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Descriere</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-200" placeholder="Scurtă descriere (opțional)" rows={3} />
          </div>
          </form>
        </div>

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200 mt-4">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm rounded-md hover:bg-gray-100">Anulează</button>
          <button type="submit" form="create-event-form" className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm">Salvează</button>
        </div>
      </div>
    </div>
  )
}
