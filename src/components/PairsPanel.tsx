import React, { useEffect, useState } from 'react'
import CreatePairModal from './CreatePairModal'
import Icon from './Icon'

export default function PairsPanel() {
  const [pairs, setPairs] = useState<any[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [openCreate, setOpenCreate] = useState(false)

  const fetchPairs = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/pairs')
      if (!res.ok) {
        setPairs([])
        return
      }
      const data = await res.json()
      setPairs(Array.isArray(data.pairs) ? data.pairs : [])
    } catch (err) {
      console.error('Failed to load pairs', err)
      setPairs([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchPairs() }, [])

  const handleCreate = async (payload: any) => {
    try {
      const res = await fetch('/api/pairs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      if (!res.ok) {
        const t = await res.text().catch(() => '')
        alert('Eroare la creare: ' + (t || res.status))
        return
      }
      await fetchPairs()
    } catch (err) {
      console.error('create pair failed', err)
      alert('Eroare la creare')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Șterge această pereche?')) return
    try {
      const res = await fetch(`/api/pairs/${encodeURIComponent(id)}`, { method: 'DELETE' })
      if (!res.ok) {
        const t = await res.text().catch(() => '')
        alert('Eroare la ștergere: ' + (t || res.status))
        return
      }
      setPairs((prev) => (prev || []).filter((p) => String(p._id || p.id) !== String(id)))
    } catch (err) {
      console.error('delete failed', err)
      alert('Eroare la ștergere')
    }
  }

  return (
    <div className="p-4 md:p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h4 className="text-lg font-semibold">Perechile mele</h4>
          <div className="text-sm text-gray-500">Gestionează perechile din club</div>
        </div>
        <div>
          <button onClick={() => setOpenCreate(true)} className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium shadow">
            <Icon name="plus" className="h-4 w-4" /> Adaugă pereche
          </button>
        </div>
      </div>

      {loading && <div className="text-sm text-gray-500">Se încarcă...</div>}
      {!loading && pairs && pairs.length === 0 && <div className="text-sm text-gray-500">Nu aveți perechi adăugate.</div>}

      <div className="space-y-3">
        {(pairs || []).map((p) => (
          <div key={p._id || p.id} className="p-3 rounded-lg bg-white shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="font-medium truncate">{`${(p.partner1 && p.partner1.fullName) || ''} / ${(p.partner2 && p.partner2.fullName) || ''}`}</div>
              <div className="text-xs text-gray-500">{p.pairCategory || ''}</div>
              <div className="text-xs text-gray-400 mt-1 truncate">{(p.partner1 && p.partner1.fullName) || ''}{(p.partner2 && p.partner2.fullName) ? ` • ${(p.partner2 && p.partner2.fullName)}` : ''}</div>
              <div className="text-xs text-gray-400 mt-1">{p.coach ? `Antrenor: ${p.coach}` : ''}{p.styles && p.styles.length ? ` • Stiluri: ${p.styles.join(', ')}` : ''}</div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => handleDelete(p._id || p.id)} className="px-3 py-1 rounded-md text-sm bg-red-50 text-red-600">Șterge</button>
            </div>
          </div>
        ))}
      </div>

      <CreatePairModal open={openCreate} onClose={() => setOpenCreate(false)} onSave={handleCreate} />
    </div>
  )
}
