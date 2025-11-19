import React, { useMemo, useState, useEffect } from 'react'
import type { NextPage } from 'next'
import Head from 'next/head'
import { GetServerSideProps } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../api/auth/[...nextauth]'
// Render a large centered calendar (no AuthCard wrapper)
import DayModal from '../../components/DayModal'
import CreateEventModal from '../../components/CreateEventModal'
import Sidebar from '../../components/Sidebar'
import EventAttendeesList from '../../components/EventAttendeesList'
import InviteModal from '../../components/InviteModal'
import SettingsProfile from '../../components/SettingsProfile'
import dbConnect from '../../lib/mongoose'
import User from '../../models/User'
import { useRouter } from 'next/router'

type DayCell = {
  date: Date
  inMonth: boolean
}

const weekdays = ['Lu', 'Ma', 'Mi', 'Jo', 'Vi', 'Sâ', 'Du']

function getMonthGrid(year: number, month: number): DayCell[] {
  // month: 0-11
  const firstOfMonth = new Date(year, month, 1)
  const lastOfMonth = new Date(year, month + 1, 0)
  const startDay = (firstOfMonth.getDay() + 6) % 7 // convert Sun=0..Sat=6 to Mon=0..Sun=6

  const cells: DayCell[] = []
  // previous month's tail
  for (let i = 0; i < startDay; i++) {
    const d = new Date(year, month, i - startDay + 1)
    cells.push({ date: d, inMonth: false })
  }

  // current month
  for (let d = 1; d <= lastOfMonth.getDate(); d++) {
    cells.push({ date: new Date(year, month, d), inMonth: true })
  }

  // fill to complete weeks (42 cells -> 6 weeks)
  while (cells.length % 7 !== 0) {
    const next = new Date(year, month, cells.length - startDay + 1)
    cells.push({ date: next, inMonth: false })
  }

  // ensure 6 rows
  while (cells.length < 42) {
    const last = cells[cells.length - 1].date
    const next = new Date(last)
    next.setDate(last.getDate() + 1)
    cells.push({ date: next, inMonth: false })
  }

  return cells
}

const AppCalendar: NextPage<{ role?: string }> = ({ role }) => {
  const today = new Date()
  const [viewYear, setViewYear] = useState(today.getFullYear())
  const [viewMonth, setViewMonth] = useState(today.getMonth())
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [showDayModal, setShowDayModal] = useState(false)

  const grid = useMemo(() => getMonthGrid(viewYear, viewMonth), [viewYear, viewMonth])

  const [events, setEvents] = useState<any[]>([])

  useEffect(() => {
    // fetch events for the visible month
    const fetchEvents = async () => {
      try {
        const from = new Date(viewYear, viewMonth, 1, 0, 0, 0).toISOString()
        const lastDay = new Date(viewYear, viewMonth + 1, 0)
        lastDay.setHours(23, 59, 59, 999)
        const to = lastDay.toISOString()

        const res = await fetch(`/api/events?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`)
        if (!res.ok) {
          setEvents([])
          return
        }
        const data = await res.json()
        setEvents(Array.isArray(data.events) ? data.events : [])
      } catch (err) {
        console.error('Failed to load events', err)
        setEvents([])
      }
    }

    fetchEvents()
  }, [viewYear, viewMonth])

  const monthName = useMemo(() => new Intl.DateTimeFormat('ro-RO', { month: 'long' }).format(new Date(viewYear, viewMonth, 1)), [viewYear, viewMonth])

  function prevMonth() {
    if (viewMonth === 0) {
      setViewMonth(11)
      setViewYear((y) => y - 1)
    } else {
      setViewMonth((m) => m - 1)
    }
  }

  function nextMonth() {
    if (viewMonth === 11) {
      setViewMonth(0)
      setViewYear((y) => y + 1)
    } else {
      setViewMonth((m) => m + 1)
    }
  }

  const [panelView, setPanelView] = useState<'calendar' | 'settings' | 'my-events' | 'admin'>('calendar')
  const [attendingEvents, setAttendingEvents] = useState<any[] | null>(null)
  const [attendingLoading, setAttendingLoading] = useState(false)
  const [attendingError, setAttendingError] = useState<string | null>(null)

  useEffect(() => {
    if (panelView !== 'my-events') return
    let mounted = true
    const fetchMyEvents = async () => {
      setAttendingLoading(true)
      setAttendingError(null)
      try {
        const res = await fetch('/api/events?attending=true&populate=true')
        if (!mounted) return
        if (!res.ok) {
          setAttendingEvents([])
          setAttendingError('Failed to load')
          return
        }
        const data = await res.json()
        setAttendingEvents(Array.isArray(data.events) ? data.events : [])
      } catch (err) {
        console.error('Failed to load attending events', err)
        setAttendingEvents([])
        setAttendingError('Server error')
      } finally {
        if (mounted) setAttendingLoading(false)
      }
    }

    fetchMyEvents()
    return () => { mounted = false }
  }, [panelView])

  const handleUnattend = async (eventId: string) => {
    // optimistic UI: remove locally first
    const before = attendingEvents || []
    setAttendingEvents(before.filter((e) => String(e._id || e.id) !== String(eventId)))
    try {
      const res = await fetch(`/api/events/${encodeURIComponent(eventId)}/attend`, { method: 'DELETE' })
      if (!res.ok) {
        // revert
        setAttendingEvents(before)
        const data = await res.json().catch(() => ({}))
        alert('Eroare la dezabonare: ' + (data.message || res.status))
      }
    } catch (err) {
      console.error('Unattend failed', err)
      setAttendingEvents(before)
      alert('Eroare la dezabonare')
    }
  }

  // admin panel state
  const [adminEvents, setAdminEvents] = useState<any[] | null>(null)
  const [adminLoading, setAdminLoading] = useState(false)
  const [adminError, setAdminError] = useState<string | null>(null)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [inviteEventId, setInviteEventId] = useState<string | null>(null)
  const [inviteEventAttendees, setInviteEventAttendees] = useState<any[] | undefined>(undefined)

  useEffect(() => {
    if (panelView !== 'admin') return
    let mounted = true
    const fetchAdmin = async () => {
      setAdminLoading(true)
      setAdminError(null)
      try {
        const res = await fetch('/api/events?all=true&populate=true')
        if (!mounted) return
        if (!res.ok) {
          setAdminEvents([])
          setAdminError('Nu aveți permisiunea sau a apărut o eroare')
          return
        }
        const data = await res.json()
        setAdminEvents(Array.isArray(data.events) ? data.events : [])
      } catch (err) {
        console.error('Failed to load admin events', err)
        setAdminEvents([])
        setAdminError('Eroare server')
      } finally {
        if (mounted) setAdminLoading(false)
      }
    }

    fetchAdmin()
    return () => { mounted = false }
  }, [panelView])

  return (
    <>
      <Head>
        <title>Calendar — FRDS</title>
      </Head>

  <main className="max-w-screen-2xl mx-auto py-12 px-4">
        <div className="space-y-6">
          <div className="flex items-start gap-6">
            <Sidebar selected={panelView} onSelect={(s) => setPanelView(s)} role={role} />

            <div className="flex-1 bg-white rounded-2xl p-6 shadow-xl">
              {panelView === 'calendar' && (
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <button onClick={prevMonth} aria-label="Luna precedentă" className="p-2 rounded-md hover:bg-gray-100 text-gray-700">
                        <span className="text-2xl">‹</span>
                      </button>
                      <div className="text-2xl font-bold text-gray-900 tracking-tight">{monthName} {viewYear}</div>
                      <button onClick={nextMonth} aria-label="Luna următoare" className="p-2 rounded-md hover:bg-gray-100 text-gray-700">
                        <span className="text-2xl">›</span>
                      </button>
                    </div>
                    <div className="text-sm text-gray-500">Vizualizare lunară</div>
                  </div>

                  <div className="flex items-center gap-3">
                    {role?.toLowerCase() !== 'dansator' && (
                      <button onClick={() => { setShowCreate(true); setSelectedDate(today) }} className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium shadow">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        Creează eveniment
                      </button>
                    )}
                  </div>
                </div>
              )}

              {panelView === 'calendar' ? (
                <div className="p-4">
                  <div className="grid grid-cols-7 gap-2 text-center border-b pb-3 mb-3">
                    {weekdays.map((d, i) => (
                      // mark Sat(5) and Sun(6) as weekend in this Mon..Sun array
                      <div key={d} className={`text-xs font-semibold ${i >= 5 ? 'text-red-500' : 'text-gray-500'} uppercase`}>{d}</div>
                    ))}
                  </div>

                  <div className="grid grid-cols-7 gap-3">
                    {grid.map((cell, idx) => {
                      const dateKey = cell.date.toDateString()
                      const isToday = dateKey === today.toDateString()
                      const inMonth = cell.inMonth
                      const weekday = cell.date.getDay() // 0=Sun .. 6=Sat
                      const isWeekend = weekday === 0 || weekday === 6
                      const cardBg = inMonth ? (isWeekend ? 'bg-red-50' : 'bg-white') : 'bg-gray-50 text-gray-400'
                      const hasEvent = Math.abs(cell.date.getDate() - today.getDate()) % 7 === 0 && inMonth

                      return (
                        <button
                          key={idx}
                          onClick={() => { setSelectedDate(cell.date); setShowDayModal(true) }}
                          className={`flex flex-col h-28 md:h-32 p-3 rounded-lg text-left transition-shadow ${cardBg} hover:shadow-md`}
                        >
                          <div className="flex items-start justify-between">
                            {isToday ? (
                              <div className="inline-flex items-center justify-center h-7 w-7 rounded-full bg-blue-600 text-white text-sm font-semibold">{cell.date.getDate()}</div>
                            ) : (
                              <div className={`text-sm font-semibold ${inMonth ? 'text-gray-900' : 'text-gray-400'}`}>{cell.date.getDate()}</div>
                            )}
                          </div>

                          <div className="mt-2 flex-1 flex flex-col justify-end">
                                  {/* render events for this date */}
                                  {(() => {
                                    const cellDate = new Date(cell.date.getFullYear(), cell.date.getMonth(), cell.date.getDate())
                                    const eventsForDay = events.filter((ev) => {
                                      const s = new Date(ev.start)
                                      const e = ev.end ? new Date(ev.end) : s
                                      // normalize to date-only comparators
                                      const startDay = new Date(s.getFullYear(), s.getMonth(), s.getDate())
                                      const endDay = new Date(e.getFullYear(), e.getMonth(), e.getDate())
                                      return cellDate >= startDay && cellDate <= endDay
                                    })

                                    if (eventsForDay.length === 0) return <div className="text-xs text-gray-300">&nbsp;</div>

                                    // show up to two events, then a +N indicator
                                    const visible = eventsForDay.slice(0, 2)
                                    return (
                                      <div className="flex flex-col gap-1">
                                        {visible.map((ev, i) => (
                                          <div key={i} className="flex items-center gap-2">
                                            <span className="h-2 w-2 rounded-full bg-blue-600 inline-block" />
                                            <span className="text-xs text-gray-700 truncate">{ev.title}</span>
                                          </div>
                                        ))}
                                        {eventsForDay.length > 2 && (
                                          <div className="text-xs text-gray-400">+{eventsForDay.length - 2} more</div>
                                        )}
                                      </div>
                                    )
                                  })()}
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>
              ) : panelView === 'my-events' ? (
                <div className="p-6">
                  <h4 className="text-lg font-semibold mb-4">Evenimente la care particip</h4>
                  <div className="bg-white rounded-lg p-4">
                    {attendingLoading && <div className="text-sm text-gray-500">Se încarcă...</div>}
                    {attendingError && <div className="text-sm text-red-500">{attendingError}</div>}
                    {!attendingLoading && attendingEvents && attendingEvents.length === 0 && (
                      <div className="text-sm text-gray-500">Nu participați la niciun eveniment.</div>
                    )}

                    <div className="space-y-3">
                      {(attendingEvents || []).map((ev) => (
                        <div key={ev._id || ev.id} className="flex items-center justify-between gap-3 p-3 border rounded-md">
                          <div>
                            <div className="text-sm font-medium">{ev.title}</div>
                            <div className="text-xs text-gray-500">{new Date(ev.start).toLocaleString('ro-RO')} {ev.location ? `• ${ev.location}` : ''}</div>
                          </div>
                          <div className="shrink-0">
                            <button onClick={() => handleUnattend(ev._id || ev.id)} className="px-3 py-1 bg-red-50 text-red-600 rounded-md text-sm">Renunță</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : panelView === 'admin' ? (
                <div className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-lg font-semibold">Panou Admin — Toate evenimentele</h4>
                    <div className="text-sm text-gray-500">Vizualizați toți participanții la evenimente</div>
                  </div>
                  {adminLoading && <div className="text-sm text-gray-500">Se încarcă...</div>}
                    {adminError && <div className="text-sm text-red-500">{adminError}</div>}

                    <div className="space-y-4">
                      {(adminEvents || []).map((ev) => (
                        <div key={ev._id || ev.id} className="p-4 rounded-lg bg-white shadow-sm">
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <div className="text-sm font-semibold">{ev.title}</div>
                              <div className="text-xs text-gray-500">{new Date(ev.start).toLocaleString('ro-RO')} {ev.location ? `• ${ev.location}` : ''}</div>
                            </div>
                            <div className="flex items-center justify-end gap-2">
                              <div className="text-xs text-gray-500">{(ev.attendees || []).length} participanți</div>
                              <button onClick={() => { setInviteEventId(ev._id || ev.id); setInviteEventAttendees(ev.attendees || []); setInviteOpen(true) }} className="text-sm px-2 py-1 bg-blue-50 text-blue-600 rounded-md">Invită</button>
                            </div>
                          </div>

                          <div className="mt-3">
                            <label className="block text-xs font-medium text-gray-600 mb-2">Caută participanți</label>
                            <EventAttendeesList attendees={ev.attendees || []} />
                          </div>
                        </div>
                      ))}
                    </div>
                </div>
              ) : (
                <div className="p-6">
                  <h4 className="text-lg font-semibold mb-4">Setări</h4>
                  <div className="bg-white">
                    <div className="p-4">
                      <SettingsProfile />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

              <CreateEventModal
                open={showCreate}
                date={selectedDate}
                onClose={() => setShowCreate(false)}
                onSave={async (payload) => {
                  try {
                    // build ISO start/end
                    let startIso: string | undefined = undefined
                    let endIso: string | undefined = undefined
                    if (payload.date) {
                      const day = new Date(payload.date)
                      if (payload.allDay) {
                        const s = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 0, 0, 0)
                        const e = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 23, 59, 59)
                        startIso = s.toISOString()
                        endIso = e.toISOString()
                      } else if (payload.startTime) {
                        const [sh, sm] = (payload.startTime || '09:00').split(':').map((s) => parseInt(s, 10))
                        const [eh, em] = (payload.endTime || payload.startTime || '10:00').split(':').map((s) => parseInt(s, 10))
                        const s = new Date(day.getFullYear(), day.getMonth(), day.getDate(), Number.isNaN(sh) ? 9 : sh, Number.isNaN(sm) ? 0 : sm, 0)
                        const e = new Date(day.getFullYear(), day.getMonth(), day.getDate(), Number.isNaN(eh) ? (s.getHours() + 1) : eh, Number.isNaN(em) ? 0 : em, 0)
                        startIso = s.toISOString()
                        endIso = e.toISOString()
                      } else {
                        startIso = day.toISOString()
                      }
                    }

                    const body = {
                      title: payload.title,
                      description: payload.description,
                      location: payload.location,
                      allDay: !!payload.allDay,
                      start: startIso,
                      end: endIso,
                    }

                    const res = await fetch('/api/events', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
                    if (!res.ok) {
                      const data = await res.json().catch(() => ({}))
                      alert('Eroare la salvare: ' + (data.message || data.error || res.status))
                    } else {
                      // reload page to show new event (no popup)
                      window.location.reload()
                    }
                  } catch (err) {
                    console.error('Error creating event', err)
                    alert('Eroare la salvare')
                  } finally {
                    setShowCreate(false)
                  }
                }}
              />
              <InviteModal
                open={inviteOpen}
                eventId={inviteEventId}
                onClose={() => setInviteOpen(false)}
                onInvited={(email) => {
                  // append a placeholder attendee (email) so the UI count updates immediately
                  setAdminEvents((prev) => {
                    if (!prev) return prev
                    return prev.map((e) => {
                      if (String(e._id || e.id) !== String(inviteEventId)) return e
                      const existing = Array.isArray(e.attendees) ? e.attendees.slice() : []
                      return { ...e, attendees: existing.concat([{ email }]) }
                    })
                  })
                  setInviteOpen(false)
                }}
              />
              <DayModal open={showDayModal} date={selectedDate} onClose={() => setShowDayModal(false)} onCreate={(d) => {
                // Prevent dancers from creating events even via DayModal
                if (role?.toLowerCase() === 'dansator') return
                setShowCreate(true)
                setShowDayModal(false)
              }} />
      </main>
    </>
  )
}

export default AppCalendar

export const getServerSideProps: GetServerSideProps = async (context) => {
  const session = await getServerSession(context.req, context.res, authOptions as any)
  if (!session) {
    return {
      redirect: {
        destination: '/login',
        permanent: false,
      },
    }
  }

  // load user role from DB and pass to the page
  try {
    const userId = (session as any)?.user?.id
    await dbConnect()
    const user = await User.findById(userId).select('role').lean()
    const role = user?.role || null
    return { props: { role } }
  } catch (err) {
    console.error('[getServerSideProps] user lookup failed', err)
    return { props: {} }
  }
}
