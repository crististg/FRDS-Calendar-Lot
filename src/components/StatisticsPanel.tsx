import React, { useEffect, useState } from 'react'

type StatResp = {
  ok: boolean
  year: number
  total: number
  events: Array<{ _id: string; title: string; start: string; end?: string | null; country?: string | null; city?: string | null; address?: string | null }>
  countries: Record<string, number>
}

export default function StatisticsPanel() {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<StatResp | null>(null)
  const [showEvents, setShowEvents] = useState(false)
  const [showCountries, setShowCountries] = useState(false)

  useEffect(() => {
    let mounted = true
    const fetchStats = async () => {
      setLoading(true)
      try {
        const res = await fetch('/api/stats/judge')
        if (!mounted) return
        if (!res.ok) {
          setData(null)
          return
        }
        const d = await res.json()
        setData(d)
      } catch (err) {
        console.error('Failed to load stats', err)
        setData(null)
      } finally {
        if (mounted) setLoading(false)
      }
    }
    fetchStats()
    return () => { mounted = false }
  }, [])

  if (loading) return <div className="p-6 bg-white rounded-xl shadow">Se încarcă statistici...</div>
  if (!data) return <div className="p-6 bg-white rounded-xl shadow">Nu s-au putut încărca statisticile.</div>

  const { year, total, events, countries } = data
  const countriesCount = Object.keys(countries || {}).length

  return (
    <div className="bg-white rounded-xl p-4 space-y-4">
      <div>
        <h4 className="text-lg font-semibold">Statistici arbitru — {year}</h4>
      </div>

      <div>
        <button
          onClick={() => setShowEvents((s) => !s)}
          className="w-full text-left px-3 py-2 bg-gray-50 rounded-md flex items-center justify-between"
        >
          <div className="text-sm text-gray-700">{showEvents ? 'Ascunde evenimente' : 'Arată evenimente'}</div>
          <div className="w-12 text-right">
            <div className="text-lg font-semibold">{total}</div>
          </div>
        </button>
        {showEvents && (
          <div className="mt-3 max-h-64 overflow-auto border rounded-md p-2">
            {events.length === 0 ? <div className="text-sm text-gray-500">Nu sunt evenimente pentru acest an.</div> : (
              <ul className="space-y-2">
                {events.map((ev) => (
                  <li key={String(ev._id)} className="text-sm">
                    <div className="font-medium">{ev.title}</div>
                    <div className="text-xs text-gray-500">{new Date(ev.start).toLocaleDateString('ro-RO')} {ev.address || ev.city || ev.country ? `• ${[ev.address, ev.city, ev.country].filter(Boolean).join(', ')}` : ''}</div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      <div>
        <button
          onClick={() => setShowCountries((s) => !s)}
          className="w-full text-left px-3 py-2 bg-gray-50 rounded-md flex items-center justify-between"
        >
          <div className="text-sm text-gray-700">{showCountries ? 'Ascunde țări' : 'Arată țări'}</div>
          <div className="w-12 text-right">
            <div className="text-lg font-semibold">{countriesCount}</div>
          </div>
        </button>
        {showCountries && (
          <div className="mt-3 border rounded-md p-2">
            {Object.keys(countries).length === 0 ? <div className="text-sm text-gray-500">Nicio țară înregistrată.</div> : (
              <ul className="space-y-2">
                {Object.entries(countries).sort((a,b) => b[1]-a[1]).map(([country, count]) => (
                  <li key={country} className="flex items-center justify-between text-sm">
                    <div>{country}</div>
                    <div className="text-gray-600">{count}</div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
