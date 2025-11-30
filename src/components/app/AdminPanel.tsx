import React from 'react'
import { FiEdit, FiTrash2 } from 'react-icons/fi'
import EventParticipantsList from '../../components/EventParticipantsList'

type Props = {
  adminEvents: any[] | null
  adminTab: 'events' | 'users'
  setAdminTab: (t: 'events' | 'users') => void
  adminError: string | null
  adminUsers?: any[] | null
  adminUsersError?: string | null
  adminEventTabs: Record<string, 'pairs' | 'judges'>
  setAdminEventTabs: (s: Record<string, 'pairs' | 'judges'>) => void
  setEditEvent: (e: any) => void
  handleDeleteEvent: (id: string) => Promise<void>
  setInviteEventId: (id: string | null) => void
  setInviteEventAttendees: (a: any[] | undefined) => void
  setShowAdminPhotos: (v: boolean) => void
  setSelectedAdminPhotosEvent: (e: any | null) => void
}

export default function AdminPanel({ adminEvents, adminTab, setAdminTab, adminError, adminUsers, adminUsersError, adminEventTabs, setAdminEventTabs, setEditEvent, handleDeleteEvent, setInviteEventId, setInviteEventAttendees, setShowAdminPhotos, setSelectedAdminPhotosEvent }: Props) {
  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h4 className="text-lg font-semibold">Panou Admin</h4>
          <div className="text-sm text-gray-500">Gestionează evenimente și utilizatori</div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setAdminTab('events')} className={`px-3 py-1 rounded-md text-sm ${adminTab === 'events' ? 'bg-blue-600 text-white' : 'bg-gray-50 text-gray-700'}`}>Evenimente</button>
          <button onClick={() => setAdminTab('users')} className={`px-3 py-1 rounded-md text-sm ${adminTab === 'users' ? 'bg-blue-600 text-white' : 'bg-gray-50 text-gray-700'}`}>Utilizatori</button>
        </div>
      </div>

      {adminTab === 'events' ? (
        <>
          {adminError && <div className="text-sm text-red-500">{adminError}</div>}
          <div className="space-y-4">
            {(adminEvents || []).map((ev) => {
              const evId = String(ev._id || ev.id)
              const selected = adminEventTabs[evId] || 'pairs'
              const pairsCount = Array.isArray(ev.attendingPairs) ? ev.attendingPairs.length : 0
              const judgesCount = Array.isArray(ev.judges) ? ev.judges.length : 0
              return (
                <div key={ev._id || ev.id} className="p-4 rounded-lg bg-white shadow-sm relative">
                  <div className="flex flex-col md:flex-row items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold">{ev.title}</div>
                      <div className="text-xs text-gray-500">{new Date(ev.start).toLocaleString('ro-RO')}{(ev.address || ev.city || ev.country) ? ` • ${[ev.address, ev.city, ev.country].filter(Boolean).join(', ')}` : ''}</div>
                      {ev.description ? <div className="text-sm text-gray-600 mt-1 truncate">{ev.description}</div> : null}
                    </div>
                    <div className="flex items-center justify-end gap-2">
                      <div className="inline-flex items-center gap-1 rounded-md bg-gray-50 p-1">
                        <button type="button" onClick={() => setAdminEventTabs({ ...adminEventTabs, [evId]: 'pairs' })} className={`px-3 py-1 text-xs rounded ${selected === 'pairs' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}>Perechi {pairsCount > 0 ? `(${pairsCount})` : ''}</button>
                        <button type="button" onClick={() => setAdminEventTabs({ ...adminEventTabs, [evId]: 'judges' })} className={`px-3 py-1 text-xs rounded ${selected === 'judges' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}>Arbitri {judgesCount > 0 ? `(${judgesCount})` : ''}</button>
                      </div>
                      <button onClick={() => setEditEvent(ev)} title="Editează" aria-label="Editează" className="p-2 rounded-md text-gray-700 hover:bg-gray-100"><FiEdit className="h-4 w-4" /></button>
                      <button onClick={() => handleDeleteEvent(ev._id || ev.id)} title="Șterge" aria-label="Șterge" className="p-2 rounded-md text-red-600 hover:bg-red-50"><FiTrash2 className="h-4 w-4" /></button>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-col md:flex-row items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="overflow-x-auto">
                        {selected === 'pairs' ? (
                          <EventParticipantsList attendees={[]} pairs={ev.attendingPairs || []} />
                        ) : (
                          // Render judges using the same pill-style pairs UI by mapping judge objects
                          <EventParticipantsList
                            attendees={[]}
                            pairs={(ev.judges || []).map((j: any) => ({
                              _id: j._id || j.id,
                              partner1: { fullName: j.fullName || [j.firstName, j.lastName].filter(Boolean).join(' ') || j.email || '' },
                            }))}
                          />
                        )}
                      </div>
                    </div>
                    <div className="relative md:absolute md:right-4 md:bottom-4 flex items-center gap-2">
                      <button onClick={() => { setInviteEventId(ev._id || ev.id); setInviteEventAttendees(ev.attendingPairs || []) }} className="text-sm px-2 py-1 bg-blue-50 text-blue-600 rounded-md whitespace-nowrap">Invită</button>
                      <button onClick={() => { setSelectedAdminPhotosEvent(ev); setShowAdminPhotos(true) }} className="text-sm px-2 py-1 bg-gray-50 text-gray-700 rounded-md whitespace-nowrap">Vezi fotografii</button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      ) : (
        <>
          {adminUsersError && <div className="text-sm text-red-500">{adminUsersError}</div>}
          <div className="space-y-4">
            {/* Render all pairs as separate cards */}
            {(() => {
              const map: Record<string, { pair: any; events: any[] }> = {}
              ;(adminEvents || []).forEach((ev) => {
                ;(ev.attendingPairs || []).forEach((p: any) => {
                  const id = String(p._id || p)
                  if (!map[id]) map[id] = { pair: p, events: [] }
                  map[id].events.push(ev)
                })
              })
              const pairs = Object.keys(map).map((k) => map[k])
              if (pairs.length === 0) return <div className="text-sm text-gray-500">Nu sunt perechi înregistrate.</div>
              return pairs.map((entry) => {
                const p = entry.pair
                const name1 = (p.partner1 && p.partner1.fullName) || ''
                const name2 = (p.partner2 && p.partner2.fullName) || ''
                const label = `${name1}${name2 ? ` / ${name2}` : ''}`
                const initials = (n: string) => {
                  const parts = (n || '').trim().split(/\s+/).filter(Boolean)
                  if (parts.length === 0) return '?'
                  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
                  return (parts[0][0] + parts[1][0]).toUpperCase()
                }
                return (
                  <div key={String(p._id || p)} className="p-4 rounded-lg bg-white shadow-sm">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-3">
                            <div className="flex items-center justify-center h-8 w-8 rounded-full bg-blue-600 text-white text-xs font-semibold">{initials(name1 || name2)}</div>
                            <div className="min-w-0">
                              <div className="text-sm font-semibold truncate">{label}</div>
                              {(p.pairCategory || p.classLevel) ? (
                                <div className="text-xs text-gray-500 truncate">{[p.pairCategory, p.classLevel].filter(Boolean).join(' • ')}</div>
                              ) : null}
                            </div>
                          </div>
                        </div>
                        <div className="text-xs text-gray-500">{entry.events.length} eveniment(e)</div>
                      </div>
                    <div className="mt-3">
                      <div className="text-xs font-medium text-gray-600 mb-2">Evenimente</div>
                      <div className="flex flex-col gap-2">
                        {entry.events.map((ev) => (
                          <div key={ev._id || ev.id} className="flex items-start gap-3">
                            <span className="h-2 w-2 rounded-full bg-blue-600 mt-2" />
                            <div className="text-sm">
                              <div className="font-medium">{ev.title}</div>
                              <div className="text-xs text-gray-500">{new Date(ev.start).toLocaleString('ro-RO')}{(ev.address || ev.city || ev.country) ? ` • ${[ev.address, ev.city, ev.country].filter(Boolean).join(', ')}` : ''}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )
              })
            })()}

            {/* Render all judges as separate cards */}
            {(() => {
              const map: Record<string, { judge: any; events: any[] }> = {}
              ;(adminEvents || []).forEach((ev) => {
                ;(ev.judges || []).forEach((j: any) => {
                  const id = String(j._id || j.id || j.email || j)
                  if (!map[id]) map[id] = { judge: j, events: [] }
                  map[id].events.push(ev)
                })
              })
              const judges = Object.keys(map).map((k) => map[k])
              if (judges.length === 0) return null
              return judges.map((entry) => {
                const j = entry.judge
                const full = j.fullName || [j.firstName, j.lastName].filter(Boolean).join(' ') || j.email || 'N/A'
                const initials = (full || '').split(/\s+/).map((s: string) => s[0]).slice(0, 2).join('').toUpperCase()
                return (
                  <div key={String(j._id || j.id || j.email || j)} className="p-4 rounded-lg bg-white shadow-sm">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center h-8 w-8 rounded-full bg-blue-600 text-white text-xs font-semibold">{initials}</div>
                        <div>
                          <div className="text-sm font-semibold">{full}</div>
                          <div className="text-xs text-gray-500">{j.email}{j.role ? ` • ${j.role}` : ''}</div>
                        </div>
                      </div>
                      <div className="text-xs text-gray-500">{entry.events.length} eveniment(e)</div>
                    </div>
                    <div className="mt-3">
                      <div className="text-xs font-medium text-gray-600 mb-2">Evenimente</div>
                      <div className="flex flex-col gap-2">
                        {entry.events.map((ev) => (
                          <div key={ev._id || ev.id} className="flex items-start gap-3">
                            <span className="h-2 w-2 rounded-full bg-blue-600 mt-2" />
                            <div className="text-sm">
                              <div className="font-medium">{ev.title}</div>
                              <div className="text-xs text-gray-500">{new Date(ev.start).toLocaleString('ro-RO')}{(ev.address || ev.city || ev.country) ? ` • ${[ev.address, ev.city, ev.country].filter(Boolean).join(', ')}` : ''}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )
              })
            })()}
          </div>
        </>
      )}
    </div>
  )
}
