import React, { useEffect, useState } from 'react'
import CreatePairModal from './CreatePairModal'
import Icon from './Icon'
import { FiEdit, FiTrash2 } from 'react-icons/fi'

export default function PairsPanel() {
  const [pairs, setPairs] = useState<any[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [openCreate, setOpenCreate] = useState(false)
  const [editPair, setEditPair] = useState<any | null>(null)

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

  const handleUpdate = async (payload: any) => {
    if (!payload || !(payload._id || payload.id)) return
    const id = payload._id || payload.id
    try {
      const res = await fetch(`/api/pairs/${encodeURIComponent(id)}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      if (!res.ok) {
        const t = await res.text().catch(() => '')
        alert('Eroare la actualizare: ' + (t || res.status))
        return
      }
      await fetchPairs()
    } catch (err) {
      console.error('update pair failed', err)
      alert('Eroare la actualizare')
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
          <button onClick={() => { setEditPair(null); setOpenCreate(true) }} className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium shadow">
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
              <div className="text-xs text-gray-400 mt-1">{p.ageCategory ? `Vârstă: ${p.ageCategory}` : ''}{p.classLevel ? ` • Clasă: ${p.classLevel}` : ''}</div>
              <div className="text-xs text-gray-400 mt-1">{p.coach ? `Antrenor: ${p.coach}` : ''}{p.discipline ? ` • Disciplina: ${p.discipline}` : ''}{p.pairCategory ? ` • Categorie: ${p.pairCategory}` : ''}</div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => { setEditPair(p); setOpenCreate(true) }} title="Editează" aria-label="Editează" className="p-2 rounded-md text-gray-700 hover:bg-gray-100"><FiEdit className="h-4 w-4" /></button>
              <button onClick={() => handleDelete(p._id || p.id)} title="Șterge" aria-label="Șterge" className="p-2 rounded-md text-red-600 hover:bg-red-50"><FiTrash2 className="h-4 w-4" /></button>
            </div>
          </div>
        ))}
      </div>

      <CreatePairModal
        open={openCreate}
        initial={editPair || undefined}
        onClose={() => { setOpenCreate(false); setEditPair(null) }}
        onSave={async (payload: any) => {
          if (editPair) {
            await handleUpdate(payload)
          } else {
            await handleCreate(payload)
          }
        }}
      />
    </div>
  )
}
