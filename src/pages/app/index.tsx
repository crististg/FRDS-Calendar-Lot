import React, { useMemo, useState, useEffect } from 'react'
import type { NextPage } from 'next'
import Head from 'next/head'
import { GetServerSideProps } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../api/auth/[...nextauth]'
// Render a large centered calendar (no AuthCard wrapper)
import DayModal from '../../components/DayModal'
import { useSession } from 'next-auth/react'
import EventModal from '../../components/EventModal'
import CreateEventModal from '../../components/CreateEventModal'
import Sidebar from '../../components/Sidebar'
import EventAttendeesList from '../../components/EventAttendeesList'
import InviteModal from '../../components/InviteModal'
import Icon from '../../components/Icon'
import AdminPhotosModal from '../../components/AdminPhotosModal'
import { FiEdit, FiTrash2 } from 'react-icons/fi'
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

function userInitials(u: any) {
  const source = (u.fullName || [u.firstName, u.lastName].filter(Boolean).join(' ') || u.email || '').trim()
  const parts = source.split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[1][0]).toUpperCase()
}

const AppCalendar: NextPage<{ role?: string; currentUserId?: string }> = ({ role, currentUserId }) => {
  const today = new Date()
  const [viewYear, setViewYear] = useState(today.getFullYear())
  const [viewMonth, setViewMonth] = useState(today.getMonth())
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [showDayModal, setShowDayModal] = useState(false)

  // mobile day list state (calendar mobile layout — top calendar, bottom day list)
  const [mobileDayEvents, setMobileDayEvents] = useState<any[] | null>(null)
  const [mobileDayLoading, setMobileDayLoading] = useState(false)
  const [selectedMobileEvent, setSelectedMobileEvent] = useState<any | null>(null)

  const grid = useMemo(() => getMonthGrid(viewYear, viewMonth), [viewYear, viewMonth])

  const [events, setEvents] = useState<any[]>([])
  const { data: session } = useSession()
  const userId = (session as any)?.user?.id

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

  // Auto-select today's date on mobile so the bottom day-list shows today's events by default
  useEffect(() => {
    if (typeof window === 'undefined') return
    // Only auto-select on small screens (mobile)
    if (window.innerWidth < 640) {
      setSelectedDate(today)
    }
  }, [])

  // Fetch events for the selected date when on small screens.
  useEffect(() => {
    if (!selectedDate) {
      setMobileDayEvents(null)
      return
    }

    // only fetch for mobile view to back the mobile layout
    if (typeof window === 'undefined' || window.innerWidth >= 640) {
      setMobileDayEvents(null)
      return
    }

    let mounted = true
    const controller = new AbortController()

    const fetchDay = async () => {
      try {
        setMobileDayLoading(true)
        const dayStart = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate(), 0, 0, 0)
        const dayEnd = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate(), 23, 59, 59, 999)
        const from = encodeURIComponent(dayStart.toISOString())
        const to = encodeURIComponent(dayEnd.toISOString())
        const res = await fetch(`/api/events?from=${from}&to=${to}&overlap=true&populate=true`, { signal: controller.signal })
        if (!mounted) return
        if (!res.ok) {
          setMobileDayEvents([])
          return
        }
        const data = await res.json()
        setMobileDayEvents(Array.isArray(data.events) ? data.events : [])
      } catch (err) {
        if ((err as any)?.name === 'AbortError') return
        console.error('Failed to load mobile day events', err)
        setMobileDayEvents([])
      } finally {
        if (mounted) setMobileDayLoading(false)
      }
    }

    fetchDay()

    return () => {
      mounted = false
      controller.abort()
    }
  }, [selectedDate])

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
  const [adminTab, setAdminTab] = useState<'events' | 'users'>('events')
  const [adminUsers, setAdminUsers] = useState<any[] | null>(null)
  const [adminUsersLoading, setAdminUsersLoading] = useState(false)
  const [adminUsersError, setAdminUsersError] = useState<string | null>(null)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [inviteEventId, setInviteEventId] = useState<string | null>(null)
  const [inviteEventAttendees, setInviteEventAttendees] = useState<any[] | undefined>(undefined)
  // edit/delete state for admin
  const [editEvent, setEditEvent] = useState<any | null>(null)
  // deep-link event modal (open when ?event=ID is present)
  const router = useRouter()
  const [deepEvent, setDeepEvent] = useState<any | null>(null)
  const [deepLoading, setDeepLoading] = useState(false)
  // admin photos modal state
  const [showAdminPhotos, setShowAdminPhotos] = useState(false)
  const [selectedAdminPhotosEvent, setSelectedAdminPhotosEvent] = useState<any | null>(null)

  useEffect(() => {
    if (panelView !== 'admin') return
    let mounted = true
    const fetchAdmin = async () => {
      setAdminLoading(true)
      setAdminError(null)
      try {
        const res = await fetch('/api/events?all=true&populate=true')
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

  // open event modal when URL contains ?event=ID
  useEffect(() => {
    if (!router.isReady) return
    const id = router.query.event
    if (!id) return
    let mounted = true
    const fetchEvent = async () => {
      setDeepLoading(true)
      try {
        const eid = Array.isArray(id) ? id[0] : String(id)
        const res = await fetch(`/api/events/${encodeURIComponent(eid)}?populate=true`)
        if (!mounted) return
        if (!res.ok) {
          setDeepEvent(null)
          return
        }
        const data = await res.json()
        setDeepEvent(data.event || null)
      } catch (err) {
        console.error('Failed to load deep event', err)
        setDeepEvent(null)
      } finally {
        if (mounted) setDeepLoading(false)
      }
    }
    fetchEvent()
    return () => { mounted = false }
  }, [router.isReady, router.query.event])

  // fetch users when users tab is active
  useEffect(() => {
    if (panelView !== 'admin' || adminTab !== 'users') return
    let mounted = true
    const fetchUsers = async () => {
      setAdminUsersLoading(true)
      setAdminUsersError(null)
      try {
        const res = await fetch('/api/users')
        if (!mounted) return
        if (!res.ok) {
          setAdminUsers([])
          setAdminUsersError('Nu s-au putut încărca utilizatorii')
          return
        }
        const data = await res.json()
        setAdminUsers(Array.isArray(data.users) ? data.users : [])
      } catch (err) {
        console.error('Failed to load users', err)
        setAdminUsers([])
        setAdminUsersError('Eroare server')
      } finally {
        if (mounted) setAdminUsersLoading(false)
      }
    }

    fetchUsers()
    return () => { mounted = false }
  }, [panelView, adminTab])

  async function handleDeleteEvent(eventId: string) {
    if (!confirm('Sigur doriți să ștergeți acest eveniment? Această acțiune este ireversibilă.')) return
    try {
      const res = await fetch(`/api/events/${encodeURIComponent(eventId)}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        alert('Eroare la ștergere: ' + (data.message || res.status))
        return
      }
      // remove from adminEvents
      setAdminEvents((prev) => (prev || []).filter((e) => String(e._id || e.id) !== String(eventId)))
    } catch (err) {
      console.error('Delete failed', err)
      alert('Eroare la ștergere')
    }
  }

  // mobile attend toggle (used in the bottom day list)
  const handleToggleAttendMobile = async (ev: any, isAttending: boolean) => {
    if (!ev || !(ev._id || ev.id)) return
    const id = ev._id || ev.id

    // optimistic update
    setMobileDayEvents((prev) => {
      if (!prev) return prev
      return prev.map((item) => {
        if (String(item._id || item.id) !== String(id)) return item
        const attendees = Array.isArray(item.attendees) ? [...item.attendees] : []
        if (isAttending) {
          return { ...item, attendees: attendees.filter((a: any) => String(a._id || a) !== String(userId)) }
        }
        return { ...item, attendees: [...attendees, { _id: userId }] }
      })
    })

    try {
      const method = isAttending ? 'DELETE' : 'POST'
      const res = await fetch(`/api/events/${encodeURIComponent(id)}/attend`, { method })
      if (!res.ok) {
        // revert by re-fetching the day's events
        if (!selectedDate) return
        const dayStart = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate(), 0, 0, 0)
        const dayEnd = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate(), 23, 59, 59, 999)
        const from = encodeURIComponent(dayStart.toISOString())
        const to = encodeURIComponent(dayEnd.toISOString())
        const r2 = await fetch(`/api/events?from=${from}&to=${to}&overlap=true&populate=true`)
        if (r2.ok) {
          const d2 = await r2.json()
          setMobileDayEvents(Array.isArray(d2.events) ? d2.events : [])
        }
        const data = await res.json().catch(() => ({}))
        alert('Eroare la actualizare participare: ' + (data.message || res.status))
      }
    } catch (err) {
      console.error('Attend toggle failed', err)
    }
  }

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
              {(() => {
                if (panelView === 'calendar') {
                  return (
                    <>
                      {/* Desktop: unchanged layout (hidden on small screens) */}
                      <div className="hidden sm:block">
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
                                <Icon name="plus" className="h-4 w-4" />
                                Creează eveniment
                              </button>
                            )}
                          </div>
                        </div>

                        <div className="p-4">
                          <div className="grid grid-cols-7 gap-2 text-center border-b pb-3 mb-3">
                            {weekdays.map((d, i) => (
                              <div key={d} className={`text-xs font-semibold ${i >= 5 ? 'text-red-500' : 'text-gray-500'} uppercase`}>{d}</div>
                            ))}
                          </div>

                          <div className="grid grid-cols-7 gap-3">
                            {grid.map((cell, idx) => {
                              const dateKey = cell.date.toDateString()
                              const isToday = dateKey === today.toDateString()
                              const inMonth = cell.inMonth
                              const weekday = cell.date.getDay()
                              const isWeekend = weekday === 0 || weekday === 6
                              const cardBg = inMonth ? (isWeekend ? 'bg-red-50' : 'bg-white') : 'bg-gray-50 text-gray-400'

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
                                    {(() => {
                                      const cellDate = new Date(cell.date.getFullYear(), cell.date.getMonth(), cell.date.getDate())
                                      const eventsForDay = events.filter((ev) => {
                                        const s = new Date(ev.start)
                                        const e = ev.end ? new Date(ev.end) : s
                                        const startDay = new Date(s.getFullYear(), s.getMonth(), s.getDate())
                                        const endDay = new Date(e.getFullYear(), e.getMonth(), e.getDate())
                                        return cellDate >= startDay && cellDate <= endDay
                                      })

                                      if (eventsForDay.length === 0) return <div className="text-xs text-gray-300">&nbsp;</div>

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
                      </div>

                      {/* Mobile: stacked layout — top: month calendar, bottom: day list */}
                      <div className="block sm:hidden">
                        <div className="mb-3">
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="text-lg font-semibold">{monthName.charAt(0).toUpperCase() + monthName.slice(1)} {viewYear}</div>
                              <div className="text-xs text-gray-500">Atinge o zi pentru a vedea evenimentele</div>
                            </div>
                            <div className="flex items-center gap-2">
                              <button onClick={prevMonth} className="h-9 w-9 flex items-center justify-center rounded-md bg-gray-100">‹</button>
                              <button onClick={nextMonth} className="h-9 w-9 flex items-center justify-center rounded-md bg-gray-100">›</button>
                              {role?.toLowerCase() !== 'dansator' && (
                                <button onClick={() => { setShowCreate(true); setSelectedDate(today) }} aria-label="Creează eveniment" className="ml-2 px-3 py-1 rounded-md bg-blue-600 text-white inline-flex items-center gap-2">
                                  <Icon name="plus" className="h-4 w-4" />
                                  <span className="text-sm">Creează</span>
                                </button>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Calendar grid area: reuse existing calendar rendering */}
                        <div className="p-2 bg-white rounded-lg mb-3 overflow-auto">
                          <div className="grid grid-cols-7 gap-2 text-center border-b pb-3 mb-3">
                            {weekdays.map((d, i) => (
                              <div key={d} className={`text-xs font-semibold ${i >= 5 ? 'text-red-500' : 'text-gray-500'} uppercase`}>{d}</div>
                            ))}
                          </div>

                          <div className="grid grid-cols-7 gap-2">
                            {grid.map((cell, idx) => {
                              const dateKey = cell.date.toDateString()
                              const isToday = dateKey === today.toDateString()
                              const inMonth = cell.inMonth
                              const weekday = cell.date.getDay()
                              const isWeekend = weekday === 0 || weekday === 6
                              const cardBg = inMonth ? (isWeekend ? 'bg-red-50' : 'bg-white') : 'bg-gray-50 text-gray-400'

                              return (
                                <button
                                  key={idx}
                                  onClick={() => { setSelectedDate(cell.date); /* mobile list will update via effect */ }}
                                  className={`flex flex-col items-center h-14 p-2 rounded-md text-center transition-shadow ${cardBg} hover:shadow-sm`}
                                >
                                  <div className="w-full flex justify-center">
                                    {isToday ? (
                                      <div className="inline-flex items-center justify-center h-7 w-7 rounded-full bg-blue-600 text-white text-sm font-semibold">{cell.date.getDate()}</div>
                                    ) : (
                                      <div className={`text-sm font-semibold ${inMonth ? 'text-gray-900' : 'text-gray-400'}`}>{cell.date.getDate()}</div>
                                    )}
                                  </div>
                                  <div className="mt-1 flex-1">
                                    {(() => {
                                      const cellDate = new Date(cell.date.getFullYear(), cell.date.getMonth(), cell.date.getDate())
                                      const eventsForDay = events.filter((ev) => {
                                        const s = new Date(ev.start)
                                        const e = ev.end ? new Date(ev.end) : s
                                        const startDay = new Date(s.getFullYear(), s.getMonth(), s.getDate())
                                        const endDay = new Date(e.getFullYear(), e.getMonth(), e.getDate())
                                        return cellDate >= startDay && cellDate <= endDay
                                      })

                                      // On mobile we only show a small dot for days that have events
                                      if (eventsForDay.length === 0) return <div className="text-xs text-gray-300">&nbsp;</div>

                                      return (
                                        <div className="mt-1 flex items-center justify-center">
                                          <span className="h-2 w-2 rounded-full bg-blue-600 inline-block" />
                                        </div>
                                      )
                                    })()}
                                  </div>
                                </button>
                              )
                            })}
                          </div>
                        </div>

                        {/* Bottom day list: shows events for selectedDate on mobile */}
                        <div className="p-3 bg-white rounded-xl">
                          <div className="flex items-center justify-between mb-2">
                            <div>
                              <h4 className="text-base font-semibold">{selectedDate ? selectedDate.toLocaleDateString('ro-RO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : 'Zi selectată'}</h4>
                              <p className="text-xs text-gray-500">Evenimente din această zi</p>
                            </div>
                            <div>
                              <button onClick={() => setSelectedDate(null)} className="px-2 py-1 rounded-md bg-gray-100 text-sm">Închide</button>
                            </div>
                          </div>

                          <div>
                            {mobileDayLoading && <div className="text-sm text-gray-500">Se încarcă...</div>}
                            {!mobileDayLoading && mobileDayEvents && mobileDayEvents.length === 0 && (
                              <div className="text-sm text-gray-500">Nu sunt evenimente pentru această zi.</div>
                            )}

                            {!mobileDayLoading && mobileDayEvents && mobileDayEvents.map((ev) => {
                              const s = new Date(ev.start)
                              const e = ev.end ? new Date(ev.end) : null
                              const timeLabel = ev.allDay ? 'Toată ziua' : (e ? `${s.toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' })} - ${e.toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' })}` : s.toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' }))
                              const attendees = Array.isArray(ev.attendees) ? ev.attendees : []
                              return (
                                <div key={ev._id || ev.id || ev.title} className="flex items-start gap-3 justify-between py-3">
                                  <div onClick={() => { setSelectedMobileEvent(ev) }} role="button" tabIndex={0} className="flex items-start gap-3 cursor-pointer flex-1">
                                    <span className="h-2 w-2 rounded-full bg-blue-600 mt-2" />
                                    <div>
                                      <div className="text-sm font-medium">{ev.title}</div>
                                      <div className="text-xs text-gray-500">{timeLabel}{ev.location ? ` • ${ev.location}` : ''}</div>
                                      {attendees.length > 0 && <div className="text-xs text-gray-400 mt-1">{attendees.length} participant{attendees.length > 1 ? 'i' : ''}</div>}
                                    </div>
                                  </div>

                                  <div className="ml-3 flex items-center gap-2">
                                    {userId ? (
                                      (() => {
                                        const isAttending = Boolean(userId && Array.isArray(ev.attendees) && ev.attendees.some((a: any) => String(a._id || a) === String(userId)))
                                        return (
                                          <button
                                            onClick={() => handleToggleAttendMobile(ev, isAttending)}
                                            className={`px-3 py-1 rounded-md text-sm ${isAttending ? 'bg-red-50 text-red-600' : 'bg-blue-600 text-white'}`}
                                          >
                                            {isAttending ? 'Renunță' : 'Participă'}
                                          </button>
                                        )
                                      })()
                                    ) : (
                                      <button onClick={() => { setSelectedMobileEvent(ev) }} className="px-3 py-1 rounded-md bg-blue-600 text-white text-sm">Vezi</button>
                                    )}
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      </div>
                    </>
                  )
                }

                if (panelView === 'my-events') {
                  return (
                    <div className="p-4 md:p-6">
                      <h4 className="text-lg font-semibold mb-4">Evenimente la care particip</h4>
                      {attendingError && <div className="text-sm text-red-500">{attendingError}</div>}
                      {!attendingLoading && attendingEvents && attendingEvents.length === 0 && (
                        <div className="text-sm text-gray-500">Nu participați la niciun eveniment.</div>
                      )}

                      <div className="space-y-3">
                        {(attendingEvents || []).map((ev) => {
                          return (
                            <div key={ev._id || ev.id} className="flex flex-col md:flex-row items-start gap-3 justify-between">
                              <div className="flex items-start gap-3 flex-1 min-w-0">
                                <span className="h-2 w-2 rounded-full bg-blue-600 mt-2" />
                                <div>
                                  <div className="text-sm font-medium">{ev.title}</div>
                                  <div className="text-xs text-gray-500">{new Date(ev.start).toLocaleString('ro-RO')}{ev.location ? ` • ${ev.location}` : ''}</div>
                                  {(() => {
                                    const myPhotos = (ev.photos || []).filter((p: any) => String(p.uploadedBy || '') === String(currentUserId || ''))
                                    if (myPhotos.length === 0) return null
                                    return (
                                      <div className="mt-2 flex items-center gap-1">
                                        {myPhotos.map((p: any, i: number) => (
                                          <div key={p.blobId || p.url || p.tempId || i} className="relative h-6 w-6">
                                            <img src={p.url} alt={p.filename || 'photo'} onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} className="h-6 w-6 object-cover rounded-md" />
                                            <button onClick={async () => {
                                              if (!confirm('Șterge această fotografie?')) return
                                              try {
                                                if (p.tempId && !p.blobId) {
                                                  setAttendingEvents((prev) => {
                                                    if (!prev) return prev
                                                    return prev.map((ee) => {
                                                      if (String(ee._id || ee.id) !== String(ev._id || ev.id)) return ee
                                                      const next = { ...(ee || {}) }
                                                      next.photos = (next.photos || []).filter((pp: any) => pp.tempId !== p.tempId)
                                                      return next
                                                    })
                                                  })
                                                  return
                                                }

                                                const res = await fetch(`/api/events/${encodeURIComponent(ev._id || ev.id)}/photos?blobId=${encodeURIComponent(p.blobId || '')}&url=${encodeURIComponent(p.url || '')}`, { method: 'DELETE' })
                                                if (!res.ok) {
                                                  const t = await res.text().catch(() => '')
                                                  alert('Ștergere eșuată: ' + (t || res.status))
                                                  return
                                                }
                                                setAttendingEvents((prev) => {
                                                  if (!prev) return prev
                                                  return prev.map((ee) => {
                                                    if (String(ee._id || ee.id) !== String(ev._id || ev.id)) return ee
                                                    const next = { ...(ee || {}) }
                                                    next.photos = (next.photos || []).filter((pp: any) => {
                                                      if (p.blobId && pp.blobId) return String(pp.blobId) !== String(p.blobId)
                                                      if (p.url && pp.url) return String(pp.url) !== String(p.url)
                                                      return true
                                                    })
                                                    return next
                                                  })
                                                })
                                              } catch (err) {
                                                console.error('delete photo failed', err)
                                                alert('Ștergere eșuată')
                                              }
                                            }} className="absolute -top-1 -right-1 bg-white rounded-full text-xs text-red-600 h-5 w-5 flex items-center justify-center shadow">×</button>
                                          </div>
                                        ))}
                                      </div>
                                    )
                                  })()}
                                </div>
                              </div>
                              <div className="shrink-0 flex items-center gap-2 md:ml-4 mt-3 md:mt-0">
                                <input id={`file-${ev._id || ev.id}`} type="file" accept="image/*" className="hidden" onChange={async (e) => {
                                  const file = (e.target as HTMLInputElement).files?.[0]
                                  if (!file) return
                                  try {
                                    const eventId = String(ev._id || ev.id)
                                    const q = new URLSearchParams({ filename: file.name, eventId })
                                    const resp = await fetch(`/api/uploads/blob?${q.toString()}`, { method: 'POST', headers: { 'Content-Type': file.type, 'X-Filename': file.name }, body: file as any })
                                    if (!resp.ok) {
                                      const t = await resp.text().catch(() => '')
                                      console.error('upload failed', resp.status, t)
                                      alert('Upload failed: ' + (t || resp.status))
                                      return
                                    }
                                    const data = await resp.json()
                                    const photo = data.photo || data
                                    setAttendingEvents((prev) => {
                                      if (!prev) return prev
                                      return prev.map((ee) => {
                                        if (String(ee._id || ee.id) !== String(ev._id || ev.id)) return ee
                                        const next = { ...(ee || {}) }
                                        next.photos = Array.isArray(next.photos) ? next.photos.concat([photo]) : [photo]
                                        return next
                                      })
                                    })
                                  } catch (err) {
                                    console.error('file upload failed', err)
                                    alert('Upload failed')
                                  } finally {
                                    ;(e.target as HTMLInputElement).value = ''
                                  }
                                }} />
                                <label htmlFor={`file-${ev._id || ev.id}`} className="px-3 py-1 rounded-md text-sm bg-gray-50 text-gray-700 cursor-pointer">Încarcă</label>
                                <button onClick={() => handleUnattend(ev._id || ev.id)} className="px-3 py-1 rounded-md text-sm bg-red-50 text-red-600">Renunță</button>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                }

                if (panelView === 'admin') {
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
                            {(adminEvents || []).map((ev) => (
                              <div key={ev._id || ev.id} className="p-4 rounded-lg bg-white shadow-sm relative">
                                <div className="flex flex-col md:flex-row items-start justify-between gap-4">
                                  <div className="flex-1 min-w-0">
                                    <div>
                                      <div className="text-sm font-semibold">{ev.title}</div>
                                      <div className="text-xs text-gray-500">{new Date(ev.start).toLocaleString('ro-RO')} {ev.location ? `• ${ev.location}` : ''}</div>
                                      {ev.description ? (
                                        <div className="text-sm text-gray-600 mt-1 truncate">{ev.description}</div>
                                      ) : null}
                                    </div>
                                  </div>
                                  <div className="flex items-center justify-end gap-2">
                                    <div className="text-xs text-gray-500">{(ev.attendees || []).length} participanți</div>
                                    <button onClick={() => setEditEvent(ev)} title="Editează" aria-label="Editează" className="p-2 rounded-md text-gray-700 hover:bg-gray-100"><FiEdit className="h-4 w-4" /></button>
                                    <button onClick={() => handleDeleteEvent(ev._id || ev.id)} title="Șterge" aria-label="Șterge" className="p-2 rounded-md text-red-600 hover:bg-red-50"><FiTrash2 className="h-4 w-4" /></button>
                                  </div>
                                </div>
                                <div className="mt-3 flex flex-col md:flex-row items-start justify-between gap-4">
                                  <div className="flex-1 min-w-0">
                                    <div className="overflow-x-auto">
                                      <EventAttendeesList attendees={ev.attendees || []} />
                                    </div>
                                  </div>
                                  <div className="relative md:absolute md:right-4 md:bottom-4 flex items-center gap-2">
                                    <button onClick={() => { setInviteEventId(ev._id || ev.id); setInviteEventAttendees(ev.attendees || []); setInviteOpen(true) }} className="text-sm px-2 py-1 bg-blue-50 text-blue-600 rounded-md whitespace-nowrap">Invită</button>
                                    <button onClick={() => { setSelectedAdminPhotosEvent(ev); setShowAdminPhotos(true) }} className="text-sm px-2 py-1 bg-gray-50 text-gray-700 rounded-md whitespace-nowrap">Vezi fotografii</button>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </>
                      ) : (
                        <>
                          {adminUsersError && <div className="text-sm text-red-500">{adminUsersError}</div>}
                          <div className="space-y-4">
                            {(adminUsers || []).map((u) => {
                              const userId = u._id || u.id
                              const userEmail = u.email
                              const userEvents = (adminEvents || []).filter((ev) => (ev.attendees || []).some((a: any) => String(a._id || a.id || a) === String(userId) || (a.email && String(a.email) === String(userEmail))))
                              return (
                                <div key={String(u._id || u.id || u.email)} className="p-4 rounded-lg bg-white shadow-sm">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                      <div className="flex items-center justify-center h-8 w-8 rounded-full bg-blue-600 text-white text-xs font-semibold">{userInitials(u)}</div>
                                      <div>
                                        <div className="text-sm font-semibold">{u.fullName || [u.firstName, u.lastName].filter(Boolean).join(' ') || u.email}</div>
                                        <div className="text-xs text-gray-500">{u.email}{u.role ? ` • ${u.role}` : ''}</div>
                                      </div>
                                    </div>
                                    <div className="text-xs text-gray-500">{userEvents.length} eveniment(e)</div>
                                  </div>
                                  <div className="mt-3">
                                    {userEvents.length === 0 ? (
                                      <div className="text-sm text-gray-500">Nu participă la evenimente.</div>
                                    ) : (
                                      <div className="flex flex-col gap-2">
                                        {userEvents.map((ev) => (
                                          <div key={ev._id || ev.id} className="flex items-start gap-3">
                                            <span className="h-2 w-2 rounded-full bg-blue-600 mt-2" />
                                            <div className="text-sm">
                                              <div className="font-medium">{ev.title}</div>
                                              <div className="text-xs text-gray-500">{new Date(ev.start).toLocaleString('ro-RO')}{ev.location ? ` • ${ev.location}` : ''}</div>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        </>
                      )}
                    </div>
                  )
                }

                // settings
                return (
                  <div className="p-6">
                    <h4 className="text-lg font-semibold mb-4">Setări</h4>
                    <div className="bg-white">
                      <div className="p-4">
                        <SettingsProfile />
                      </div>
                    </div>
                  </div>
                )
              })()}
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
                onInvited={() => {
                  // Only send an email when inviting from the modal — do not modify event attendees here.
                  setInviteOpen(false)
                }}
              />
              {/* Deep-linked single event modal */}
              <EventModal
                open={!!deepEvent}
                event={deepEvent}
                onClose={() => {
                  setDeepEvent(null)
                  // remove query param
                  const q = { ...router.query }
                  if (q && 'event' in q) {
                    delete (q as any).event
                    router.replace({ pathname: router.pathname, query: q }, undefined, { shallow: true })
                  }
                }}
                onUpdated={(updated) => {
                  if (!updated) return
                  // update adminEvents and attendingEvents if present
                  setAdminEvents((prev) => (prev || []).map((e) => (String(e._id || e.id) === String(updated._id || updated.id) ? updated : e)))
                  setAttendingEvents((prev) => (prev || []).map((e) => (String(e._id || e.id) === String(updated._id || updated.id) ? updated : e)))
                }}
              />
              {/* Mobile-selected event opener (from bottom day list) */}
              <EventModal
                open={!!selectedMobileEvent}
                event={selectedMobileEvent}
                onClose={() => setSelectedMobileEvent(null)}
                onUpdated={(updated) => {
                  if (!updated) return
                  setAdminEvents((prev) => (prev || []).map((e) => (String(e._id || e.id) === String(updated._id || updated.id) ? updated : e)))
                  setAttendingEvents((prev) => (prev || []).map((e) => (String(e._id || e.id) === String(updated._id || updated.id) ? updated : e)))
                  setSelectedMobileEvent(null)
                }}
              />
              <AdminPhotosModal open={showAdminPhotos} event={selectedAdminPhotosEvent} onClose={() => setShowAdminPhotos(false)} />
              {/* Edit event modal (admin) */}
              <CreateEventModal
                open={!!editEvent}
                date={editEvent ? new Date(editEvent.start) : null}
                initial={editEvent || undefined}
                onClose={() => setEditEvent(null)}
                onSave={async (payload) => {
                  if (!editEvent) return
                  try {
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

                    const res = await fetch(`/api/events/${encodeURIComponent(editEvent._id || editEvent.id)}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
                    if (!res.ok) {
                      const data = await res.json().catch(() => ({}))
                      alert('Eroare la salvare: ' + (data.message || data.error || res.status))
                    } else {
                      const data = await res.json()
                      const updated = (data && data.event) ? data.event : null
                      if (updated) {
                        setAdminEvents((prev) => (prev || []).map((e) => (String(e._id || e.id) === String(updated._id || updated.id) ? updated : e)))
                      }
                      setEditEvent(null)
                    }
                  } catch (err) {
                    console.error('Error updating event', err)
                    alert('Eroare la salvare')
                  }
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

  // load user role from DB and pass to the page along with currentUserId
  const userId = (session as any)?.user?.id
  try {
    await dbConnect()
    const user = await User.findById(userId).select('role').lean()
    const role = user?.role || null
    return { props: { role, currentUserId: userId || null } }
  } catch (err) {
    console.error('[getServerSideProps] user lookup failed', err)
    return { props: { role: null, currentUserId: userId || null } }
  }
}
