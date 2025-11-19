import React, { useState, useEffect } from 'react'

type Props = {
  open: boolean
  date: Date | null
  onClose: () => void
  onSave: (payload: { date: Date | null; title: string; description?: string; time?: string | null; startTime?: string | null; endTime?: string | null; allDay?: boolean; location?: string }) => void
}

export default function CreateEventModal({ open, date, onClose, onSave }: Props) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [dateValue, setDateValue] = useState(() => {
    if (!date) return ''
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, '0')
    const d = String(date.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  })
  const [timeValue, setTimeValue] = useState('09:00')
  const [startTime, setStartTime] = useState('09:00')
  const [endTime, setEndTime] = useState('10:00')
  const [allDay, setAllDay] = useState(false)
  const [location, setLocation] = useState('')

  // Sync dateValue when opening the modal or when the date prop changes
  useEffect(() => {
    if (open) {
      if (date) {
        const y = date.getFullYear()
        const m = String(date.getMonth() + 1).padStart(2, '0')
        const d = String(date.getDate()).padStart(2, '0')
        setDateValue(`${y}-${m}-${d}`)
      } else {
        setDateValue('')
      }
      // if date includes time, prefill timeValue
      if (date) {
        const h = String(date.getHours()).padStart(2, '0')
        const m = String(date.getMinutes()).padStart(2, '0')
        setTimeValue(`${h}:${m}`)
        setStartTime(`${h}:${m}`)
        // default end time one hour later
        const endDate = new Date(date)
        endDate.setHours(endDate.getHours() + 1)
        const eh = String(endDate.getHours()).padStart(2, '0')
        const em = String(endDate.getMinutes()).padStart(2, '0')
        setEndTime(`${eh}:${em}`)
      } else {
        setTimeValue('09:00')
        setStartTime('09:00')
        setEndTime('10:00')
      }
    }
  }, [open, date])

  if (!open) return null

  function submit(e: React.FormEvent) {
    e.preventDefault()
    let payloadDate: Date | null = null
  if (dateValue) {
      // dateValue is yyyy-mm-dd
      const [yyyy, mm, dd] = dateValue.split('-').map((s) => parseInt(s, 10))
      if (!Number.isNaN(yyyy) && !Number.isNaN(mm) && !Number.isNaN(dd)) {
        if (allDay) {
          payloadDate = new Date(yyyy, mm - 1, dd, 0, 0, 0)
        } else {
          // use startTime for the event datetime
          const [hh, min] = startTime.split(':').map((s) => parseInt(s, 10))
          const hhNum = Number.isNaN(hh) ? 9 : hh
          const minNum = Number.isNaN(min) ? 0 : min
          payloadDate = new Date(yyyy, mm - 1, dd, hhNum, minNum, 0)
        }
      } else {
        payloadDate = date
      }
    } else {
      payloadDate = date
    }

    onSave({ date: payloadDate, title, description, time: allDay ? null : startTime, startTime: allDay ? null : startTime, endTime: allDay ? null : endTime, allDay, location })
    setTitle('')
    setDescription('')
    setLocation('')
    setTimeValue('09:00')
    setStartTime('09:00')
    setEndTime('10:00')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-white rounded-xl shadow-2xl p-6">
        <h3 className="text-xl font-semibold mb-2">Creează eveniment</h3>
        <p className="text-sm text-gray-500 mb-4">Data: {dateValue || (date ? date.toLocaleDateString('ro-RO') : '-')}</p>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Titlu</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-200" placeholder="Nume eveniment" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Date selector spans full width */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700">Data</label>
              <input type="date" value={dateValue} onChange={(e) => setDateValue(e.target.value)} className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-md" />
            </div>

            {/* Hours and all-day checkbox on a new line under the date selector (full width) */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700">Oră</label>
              <div className="flex items-center gap-3 mt-1">
                {!allDay ? (
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    {/* Start time: 24-hour selects */}
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <select
                        value={startTime.split(':')[0]}
                        onChange={(e) => {
                          const min = startTime.split(':')[1] || '00'
                          setStartTime(`${e.target.value}:${min}`)
                        }}
                        className="px-3 py-2 border border-gray-200 rounded-md bg-white"
                      >
                        {Array.from({ length: 24 }).map((_, i) => {
                          const hh = String(i).padStart(2, '0')
                          return (
                            <option key={hh} value={hh}>
                              {hh}
                            </option>
                          )
                        })}
                      </select>
                      <span className="text-sm text-gray-500">:</span>
                      <select
                        value={startTime.split(':')[1] || '00'}
                        onChange={(e) => {
                          const hh = startTime.split(':')[0] || '09'
                          setStartTime(`${hh}:${e.target.value}`)
                        }}
                        className="px-3 py-2 border border-gray-200 rounded-md bg-white"
                      >
                        {['00', '15', '30', '45'].map((m) => (
                          <option key={m} value={m}>
                            {m}
                          </option>
                        ))}
                      </select>
                    </div>

                    <span className="text-sm text-gray-500 mx-1">—</span>

                    {/* End time: 24-hour selects */}
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <select
                        value={endTime.split(':')[0]}
                        onChange={(e) => {
                          const min = endTime.split(':')[1] || '00'
                          setEndTime(`${e.target.value}:${min}`)
                        }}
                        className="px-3 py-2 border border-gray-200 rounded-md bg-white"
                      >
                        {Array.from({ length: 24 }).map((_, i) => {
                          const hh = String(i).padStart(2, '0')
                          return (
                            <option key={hh} value={hh}>
                              {hh}
                            </option>
                          )
                        })}
                      </select>
                      <span className="text-sm text-gray-500">:</span>
                      <select
                        value={endTime.split(':')[1] || '00'}
                        onChange={(e) => {
                          const hh = endTime.split(':')[0] || '10'
                          setEndTime(`${hh}:${e.target.value}`)
                        }}
                        className="px-3 py-2 border border-gray-200 rounded-md bg-white"
                      >
                        {['00', '15', '30', '45'].map((m) => (
                          <option key={m} value={m}>
                            {m}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-gray-500 flex-1">Eveniment pe toată ziua</div>
                )}

                <label className="inline-flex items-center gap-2 shrink-0">
                  <input type="checkbox" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} />
                  <span>Toată ziua</span>
                </label>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Locație</label>
            <input value={location} onChange={(e) => setLocation(e.target.value)} className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-200" placeholder="Unde are loc? (opțional)" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Descriere</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-200" placeholder="Scurtă descriere (opțional)" rows={3} />
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm rounded-md hover:bg-gray-100">Anulează</button>
            <button type="submit" className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm">Salvează</button>
          </div>
        </form>
      </div>
    </div>
  )
}
