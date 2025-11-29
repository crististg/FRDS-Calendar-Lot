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
import PairsSelectModal from '../../components/PairsSelectModal'
import CreateEventModal from '../../components/CreateEventModal'
import StatisticsPanel from '../../components/StatisticsPanel'
import PairsPanel from '../../components/PairsPanel'
import Sidebar from '../../components/Sidebar'
import EventParticipantsList from '../../components/EventParticipantsList'
import PairUploadModal from '../../components/PairUploadModal'
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
  const [selectedMyEvent, setSelectedMyEvent] = useState<any | null>(null)

  const grid = useMemo(() => getMonthGrid(viewYear, viewMonth), [viewYear, viewMonth])

  const [events, setEvents] = useState<any[]>([])
  const { data: session } = useSession()
  const userId = (session as any)?.user?.id
  // viewerId: prefer session userId, fallback to server-provided currentUserId prop
  const viewerId = userId || currentUserId || null

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

  const [panelView, setPanelView] = useState<'calendar' | 'settings' | 'my-events' | 'admin' | 'statistics' | 'pairs'>('calendar')
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

  

  const handleUnattend = async (ev: any) => {
    if (!ev || !(ev._id || ev.id)) return
    const eventId = String(ev._id || ev.id)

    const roleLocal = (session as any)?.user?.role
    const isClubLocal = String(roleLocal || '').toLowerCase() === 'club'

    // If viewer is a club, remove the club's pairs from the event (send pairIds)
    if (isClubLocal) {
      try {
        const pairs = Array.isArray(ev.attendingPairs) ? ev.attendingPairs : []
        const myPairIds = pairs.filter((p: any) => String(p.club || p) === String(viewerId)).map((p: any) => String(p._id || p))
        if (myPairIds.length === 0) {
          alert('Nu aveți perechi înscrise la acest eveniment.')
          return
        }

        // call API to remove these pairIds
        const res = await fetch(`/api/events/${encodeURIComponent(eventId)}/attend`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pairIds: myPairIds }),
        })
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          alert('Eroare la dezabonare: ' + (data.message || res.status))
          return
        }
        const data = await res.json()
        const updated = data && data.event ? data.event : null
        if (updated) {
          setAttendingEvents((prev) => (prev || []).map((e) => (String(e._id || e.id) === String(updated._id || updated.id) ? updated : e)))
        }
      } catch (err) {
        console.error('Unattend (pairs) failed', err)
        alert('Eroare la dezabonare')
      }

      return
    }

    // Non-club users (judges) — remove the user as judge. Use optimistic removal.
    const before = attendingEvents || []
    setAttendingEvents(before.filter((e) => String(e._id || e.id) !== String(eventId)))
    try {
      const res = await fetch(`/api/events/${encodeURIComponent(eventId)}/attend`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user: true }),
      })
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
  const [selectedPairForUpload, setSelectedPairForUpload] = useState<Record<string, string | null>>({})
  const [pairUploadOpen, setPairUploadOpen] = useState(false)
  const [pairUploadEvent, setPairUploadEvent] = useState<any | null>(null)
  // per-event selected view in admin panel: 'pairs' | 'judges'
  const [adminEventTabs, setAdminEventTabs] = useState<Record<string, 'pairs' | 'judges'>>({})
  const [inviteOpen, setInviteOpen] = useState(false)
  const [inviteEventId, setInviteEventId] = useState<string | null>(null)
  const [inviteEventAttendees, setInviteEventAttendees] = useState<any[] | undefined>(undefined)
  // edit/delete state for admin
  const [editEvent, setEditEvent] = useState<any | null>(null)
  const [openPairsForEvent, setOpenPairsForEvent] = useState<any | null>(null)
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

    const roleLocal = (session as any)?.user?.role
    const isClubLocal = String(roleLocal || '').toLowerCase() === 'club'

    // If the current user is a club, open the pairs selector (and refresh the event) so they can pick pairs.
    if (isClubLocal) {
      try {
        // refresh event then open modal
        const res = await fetch(`/api/events/${encodeURIComponent(id)}?populate=true`)
        if (res.ok) {
          const d = await res.json()
          const event = d.event || ev
          // update mobile day events list
          setMobileDayEvents((prev) => (prev || []).map((it) => (String(it._id || it.id) === String(event._id || event.id) ? event : it)))
          setOpenPairsForEvent(event)
        } else {
          setOpenPairsForEvent(ev)
        }
      } catch (err) {
        console.error('Failed to open pairs selector', err)
        setOpenPairsForEvent(ev)
      }
      return
    }

    // Non-club users: attempt to register/unregister as a judge via API and let server validate.
    try {
      const method = isAttending ? 'DELETE' : 'POST'
      const res = await fetch(`/api/events/${encodeURIComponent(id)}/attend`, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user: true }) })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        alert('Eroare la actualizare participare: ' + (data.message || res.status))
        return
      }
      const d = await res.json()
      if (d && d.event) {
        const updated = d.event
        setMobileDayEvents((prev) => (prev || []).map((it) => (String(it._id || it.id) === String(updated._id || updated.id) ? updated : it)))
      }
    } catch (err) {
      console.error('Attend toggle failed', err)
      alert('Eroare la actualizare participare')
    }
  }

  const handleSavePairsForEvent = async (selectedIds: string[]) => {
    const ev = openPairsForEvent
    if (!ev || !ev._id) return
    const id = ev._id || ev.id
    const existing = (ev.attendingPairs || []).map((p: any) => String(p._id || p))
    const toAdd = selectedIds.filter((s) => !existing.includes(String(s)))
    const toRemove = existing.filter((e: string) => !selectedIds.includes(String(e)))

    // optimistic update
    setMobileDayEvents((prev) => (prev || []).map((it) => (String(it._id || it.id) === String(id) ? { ...it, attendingPairs: selectedIds.map((sid) => ({ _id: sid })) } : it)))

    try {
      if (toAdd.length) {
        await fetch(`/api/events/${encodeURIComponent(id)}/attend`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pairIds: toAdd }) })
      }
      if (toRemove.length) {
        await fetch(`/api/events/${encodeURIComponent(id)}/attend`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pairIds: toRemove }) })
      }
      // refresh event
      const r = await fetch(`/api/events/${encodeURIComponent(id)}?populate=true`)
      if (r.ok) {
        const d = await r.json()
        const refreshed = d.event
        if (refreshed) setMobileDayEvents((prev) => (prev || []).map((it) => (String(it._id || it.id) === String(refreshed._id || refreshed.id) ? refreshed : it)))
      }
    } catch (err) {
      console.error('Failed to update pairs attendance', err)
    } finally {
      setOpenPairsForEvent(null)
    }
  }

  // Helper: upload a single file for an event (used by inline/judge upload)
  async function uploadFileForEvent(file: File | null, ev: any) {
    if (!file || !ev) return
    try {
      const eventId = String(ev._id || ev.id)
      const selectedPairId = selectedPairForUpload[String(ev._id || ev.id)] || null

      // client-side quick limit check: per-pair or per-user per-event
      if (selectedPairId) {
        const existingForPair = Array.isArray(ev.photos) ? ev.photos.filter((p: any) => String(p.pairId || '') === String(selectedPairId)).length : 0
        if (existingForPair >= 4) {
          alert('Ai atins limita de 4 fotografii pentru această pereche.')
          return
        }
      } else {
        const existing = Array.isArray(ev.photos) ? ev.photos.filter((p: any) => String(p.uploadedBy || '') === String(viewerId || '')).length : 0
        if (existing >= 4) {
          alert('Ai atins limita de 4 fotografii pentru acest eveniment.')
          return
        }
      }

      const qObj: any = { filename: file.name, eventId }
      if (selectedPairId) qObj.pairId = selectedPairId
      const q = new URLSearchParams(qObj)
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
                            {role && (() => { const r = String(role).toLowerCase(); return r !== 'dansator' && r !== 'club' })() && (
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
                              {role && (() => { const r = String(role).toLowerCase(); return r !== 'dansator' && r !== 'club' })() && (
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
                              const pairs = Array.isArray(ev.attendingPairs) ? ev.attendingPairs : []
                              return (
                                <div key={ev._id || ev.id || ev.title} className="flex items-start gap-3 justify-between py-3">
                                  <div onClick={() => { setSelectedMobileEvent(ev) }} role="button" tabIndex={0} className="flex items-start gap-3 cursor-pointer flex-1">
                                    <span className="h-2 w-2 rounded-full bg-blue-600 mt-2" />
                                    <div>
                                      <div className="text-sm font-medium">{ev.title}</div>
                                      <div className="text-xs text-gray-500">{timeLabel}{(ev.address || ev.city || ev.country) ? ` • ${[ev.address, ev.city, ev.country].filter(Boolean).join(', ')}` : ''}</div>
                                      {pairs.length > 0 && <div className="text-xs text-gray-400 mt-1">{pairs.length} pereche{pairs.length > 1 ? 'i' : ''}</div>}
                                    </div>
                                  </div>

                                  <div onClick={(e) => e.stopPropagation()} className="ml-3 flex items-center gap-2">
                                    {userId ? (
                                      (() => {
                                        // prefer session user role when available, fallback to server-provided `role` prop
                                        const roleLocal = (session as any)?.user?.role || role
                                        const isClubLocal = String(roleLocal || '').toLowerCase() === 'club'
                                        const isJudgeLocal = Boolean(viewerId && Array.isArray(ev.judges) && ev.judges.some((j: any) => String(j._id || j) === String(viewerId)))

                                        // club users manage pairs
                                        if (isClubLocal) {
                                          const hasMyPairs = Array.isArray(pairs) && pairs.some((p: any) => String(p.club) === String(userId))
                                          return (
                                            <button
                                              onClick={async (e) => {
                                                e.stopPropagation()
                                                try {
                                                  const id = ev._id || ev.id
                                                  const res = await fetch(`/api/events/${encodeURIComponent(id)}?populate=true`)
                                                  if (res.ok) {
                                                    const d = await res.json()
                                                    const event = d.event || ev
                                                    setMobileDayEvents((prev) => (prev || []).map((it) => (String(it._id || it.id) === String(event._id || event.id) ? event : it)))
                                                    setOpenPairsForEvent(event)
                                                  } else {
                                                    setOpenPairsForEvent(ev)
                                                  }
                                                } catch (err) {
                                                  console.error('Failed to open pairs selector', err)
                                                  setOpenPairsForEvent(ev)
                                                }
                                              }}
                                              className={`px-3 py-1 rounded-md text-sm ${hasMyPairs ? 'bg-red-50 text-red-600' : 'bg-blue-600 text-white'} cursor-pointer`}>
                                              {hasMyPairs ? 'Gestionează' : 'Participă'}
                                            </button>
                                          )
                                        }

                                        // judges can toggle attendance like in DayModal
                                        if (isJudgeLocal) {
                                          const isAttendingJudge = Boolean(viewerId && Array.isArray(ev.judges) && ev.judges.some((a: any) => String(a._id || a) === String(viewerId)))
                                          return (
                                            <button onClick={(e) => { e.stopPropagation(); handleToggleAttendMobile(ev, isAttendingJudge) }} className={`px-3 py-1 rounded-md text-sm ${isAttendingJudge ? 'bg-red-50 text-red-600' : 'bg-blue-600 text-white'} cursor-pointer`}>
                                              {isAttendingJudge ? 'Renunță' : 'Participă'}
                                            </button>
                                          )
                                        }

                                        // other users cannot participate directly
                                        return (
                                          <button disabled className="px-3 py-1 rounded-md bg-gray-100 text-gray-500 text-sm cursor-not-allowed" title="Participarea se face prin club/pereche">Participă</button>
                                        )
                                      })()
                                    ) : (
                                      <button onClick={(e) => { e.stopPropagation(); setSelectedMobileEvent(ev) }} className="px-3 py-1 rounded-md bg-blue-600 text-white text-sm cursor-pointer">Vezi</button>
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

                  if (panelView === 'statistics') {
                    return (
                      <div className="p-6">
                        <StatisticsPanel />
                      </div>
                    )
                  }

                  if (panelView === 'pairs') {
                    // lazy import component at top-level to avoid server-only issues
                    return (
                      <div className="p-6">
                        {/* PairsPanel shows club's pairs and allows adding new ones */}
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <React.Suspense fallback={<div className="p-4">Se încarcă...</div>}>
                          <PairsPanel />
                        </React.Suspense>
                      </div>
                    )
                  }

                if (panelView === 'my-events') {
                  return (
                    <div className="p-4 md:p-4 md:p-6">
                      <h4 className="text-lg font-semibold mb-4">Evenimente la care particip</h4>
                      {attendingError && <div className="text-sm text-red-500">{attendingError}</div>}
                      {!attendingLoading && attendingEvents && attendingEvents.length === 0 && (
                        <div className="text-sm text-gray-500">Nu participați la niciun eveniment.</div>
                      )}

                      <div className="space-y-3">
                        {(attendingEvents || []).map((ev) => {
                          const pairs = Array.isArray(ev.attendingPairs) ? ev.attendingPairs : []
                          const myPairs = pairs.filter((p: any) => String(p.club || p) === String(userId))
                          const isJudge = Boolean(viewerId && Array.isArray(ev.judges) && ev.judges.some((j: any) => String(j._id || j) === String(viewerId)))
                          return (
                            <div key={ev._id || ev.id} onClick={() => setSelectedMyEvent(ev)} className="flex flex-col md:flex-row items-start gap-3 justify-between cursor-pointer">
                              <div className="flex items-start gap-3 flex-1 min-w-0">
                                <span className="h-2 w-2 rounded-full bg-blue-600 mt-2" />
                                <div>
                                  <div className="text-sm font-medium">{ev.title}</div>
                                  <div className="text-xs text-gray-500">{new Date(ev.start).toLocaleString('ro-RO')}{(ev.address || ev.city || ev.country) ? ` • ${[ev.address, ev.city, ev.country].filter(Boolean).join(', ')}` : ''}</div>
                                  {myPairs.length > 0 && (
                                    <div className="text-xs text-gray-400 mt-1">Perechile mele: {myPairs.length}</div>
                                  )}
                                  {(!myPairs || myPairs.length === 0) && isJudge && (
                                    <div className="text-xs text-gray-400 mt-1">Particip ca arbitru</div>
                                  )}
                                  {/* Photo preview removed from event card — previews are shown in PairUploadModal only */}
                                  {/* Render club's pair chips directly under the event text */}
                                  {role && String(role).toLowerCase() === 'club' && myPairs.length > 0 && (
                                    <div className="mt-3">
                                      {/* On small screens show a horizontal scrollable row; on larger screens allow wrapping */}
                                      <div className="flex gap-2 overflow-x-auto sm:flex-wrap sm:overflow-visible py-1">
                                        {myPairs.map((p: any) => {
                                          const id = String(p._id || p)
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
                                            <div key={id} className="inline-flex items-center gap-2 px-2 py-1 bg-white border border-gray-100 rounded-full shadow-sm min-w-max">
                                              <div className="flex items-center justify-center h-5 w-5 sm:h-6 sm:w-6 rounded-full bg-blue-600 text-white text-xs font-semibold">{initials(name1 || name2)}</div>
                                              <div className="text-xs sm:text-sm text-gray-700 truncate max-w-40 sm:max-w-56">{label}</div>
                                            </div>
                                          )
                                        })}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                              
                              <div onClick={(e) => e.stopPropagation()} className="shrink-0 flex items-center gap-2 md:ml-4 mt-3 md:mt-0">
                                {/* If viewer is a judge, show small photo previews (up to 3) like the old event card */}
                                {isJudge && Array.isArray(ev.photos) && ev.photos.length > 0 && (
                                  <div className="flex items-center gap-2">
                                    {ev.photos.slice(0, 3).map((ph: any) => (
                                      <div key={String(ph._id || ph.blobId || ph.tempId || ph.url)} className="h-6 w-6 rounded-md overflow-hidden bg-gray-100">
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        {ph && ph.url ? (
                                          <img src={ph.url} alt={ph.filename || 'photo'} className="h-full w-full object-cover" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} />
                                        ) : (
                                          <div className="h-full w-full bg-gray-200" />
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                )}
                                {/* If club has pairs for this event, open the per-pair upload modal; otherwise show inline file input for judges/users */}
                                {myPairs && myPairs.length > 0 ? (
                                  <button type="button" onClick={() => { setPairUploadEvent(ev); setPairUploadOpen(true) }} className="px-3 py-1 rounded-md text-sm bg-gray-50 text-gray-700 cursor-pointer hover:bg-gray-100">Încarcă</button>
                                ) : (
                                  <>
                                    <input
                                      id={`file-${ev._id || ev.id}`}
                                      type="file"
                                      accept="image/*"
                                      className="hidden"
                                      onChange={(e) => {
                                        const file = (e.target as HTMLInputElement).files?.[0] || null
                                        uploadFileForEvent(file, ev)
                                        ;(e.target as HTMLInputElement).value = ''
                                      }}
                                    />
                                    {(() => {
                                      const userPhotosCount = (ev.photos || []).filter((p: any) => String(p.uploadedBy || '') === String(viewerId || '')).length
                                      if (userPhotosCount >= 4) return <span className="px-3 py-1 rounded-md text-sm bg-gray-100 text-gray-400">Limită (4)</span>
                                      return <label htmlFor={`file-${ev._id || ev.id}`} className="px-3 py-1 rounded-md text-sm bg-gray-50 text-gray-700 cursor-pointer">Încarcă</label>
                                    })()}
                                  </>
                                )}
                                <button onClick={() => handleUnattend(ev)} className="px-3 py-1 rounded-md text-sm bg-red-50 text-red-600">Renunță</button>
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
                            {(adminEvents || []).map((ev) => {
                              const evId = String(ev._id || ev.id)
                              const selected = adminEventTabs[evId] || 'pairs'
                              const pairsCount = Array.isArray(ev.attendingPairs) ? ev.attendingPairs.length : 0
                              const judgesCount = Array.isArray(ev.judges) ? ev.judges.length : 0
                              return (
                                <div key={ev._id || ev.id} className="p-4 rounded-lg bg-white shadow-sm relative">
                                  <div className="flex flex-col md:flex-row items-start justify-between gap-4">
                                    <div className="flex-1 min-w-0">
                                      <div>
                                        <div className="text-sm font-semibold">{ev.title}</div>
                                        <div className="text-xs text-gray-500">{new Date(ev.start).toLocaleString('ro-RO')}{(ev.address || ev.city || ev.country) ? ` • ${[ev.address, ev.city, ev.country].filter(Boolean).join(', ')}` : ''}</div>
                                        {ev.description ? (
                                          <div className="text-sm text-gray-600 mt-1 truncate">{ev.description}</div>
                                        ) : null}
                                      </div>
                                    </div>
                                    <div className="flex items-center justify-end gap-2">
                                      {/* Tabs: Pairs / Judges */}
                                      <div className="inline-flex items-center gap-1 rounded-md bg-gray-50 p-1">
                                        <button
                                          type="button"
                                          onClick={() => setAdminEventTabs((prev) => ({ ...prev, [evId]: 'pairs' }))}
                                          className={`px-3 py-1 text-xs rounded ${selected === 'pairs' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}>
                                          Perechi {pairsCount > 0 ? `(${pairsCount})` : ''}
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => setAdminEventTabs((prev) => ({ ...prev, [evId]: 'judges' }))}
                                          className={`px-3 py-1 text-xs rounded ${selected === 'judges' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}>
                                          Arbitri {judgesCount > 0 ? `(${judgesCount})` : ''}
                                        </button>
                                      </div>
                                      <button onClick={() => setEditEvent(ev)} title="Editează" aria-label="Editează" className="p-2 rounded-md text-gray-700 hover:bg-gray-100"><FiEdit className="h-4 w-4" /></button>
                                      <button onClick={() => handleDeleteEvent(ev._id || ev.id)} title="Șterge" aria-label="Șterge" className="p-2 rounded-md text-red-600 hover:bg-red-50"><FiTrash2 className="h-4 w-4" /></button>
                                    </div>
                                  </div>
                                  <div className="mt-3 flex flex-col md:flex-row items-start justify-between gap-4">
                                    <div className="flex-1 min-w-0">
                                        <div className="overflow-x-auto">
                                          {/* Show pairs when pairs tab selected, otherwise show judges as attendees */}
                                          {selected === 'pairs' ? (
                                            <EventParticipantsList attendees={[]} pairs={ev.attendingPairs || []} />
                                          ) : (
                                            <EventParticipantsList attendees={ev.judges || []} pairs={[]} />
                                          )}
                                        </div>
                                    </div>
                                    <div className="relative md:absolute md:right-4 md:bottom-4 flex items-center gap-2">
                                      <button onClick={() => { setInviteEventId(ev._id || ev.id); setInviteEventAttendees(ev.attendingPairs || []); setInviteOpen(true) }} className="text-sm px-2 py-1 bg-blue-50 text-blue-600 rounded-md whitespace-nowrap">Invită</button>
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
                            {(adminUsers || []).map((u) => {
                              const userId = u._id || u.id
                              const userEmail = u.email
                              const userEvents = (adminEvents || []).filter((ev) => {
                                const fromAttendees = (ev.attendees || []).some((a: any) => String(a._id || a.id || a) === String(userId) || (a.email && String(a.email) === String(userEmail)))
                                const fromPairs = (ev.attendingPairs || []).some((p: any) => String(p.club || p) === String(userId))
                                return fromAttendees || fromPairs
                              })
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
                                              <div className="text-xs text-gray-500">{new Date(ev.start).toLocaleString('ro-RO')}{(ev.address || ev.city || ev.country) ? ` • ${[ev.address, ev.city, ev.country].filter(Boolean).join(', ')}` : ''}</div>
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
                    // prefer explicit startDate / endDate for multi-day events
                    if (payload.startDate) {
                      // parse start date
                      const [sy, sm, sd] = payload.startDate.split('-').map((s) => parseInt(s, 10))
                      if (!Number.isNaN(sy) && !Number.isNaN(sm) && !Number.isNaN(sd)) {
                        if (payload.allDay) {
                          const s = new Date(sy, sm - 1, sd, 0, 0, 0)
                          if (payload.endDate) {
                            const [ey, em2, ed] = payload.endDate.split('-').map((s) => parseInt(s, 10))
                            if (!Number.isNaN(ey) && !Number.isNaN(em2) && !Number.isNaN(ed)) {
                              const e = new Date(ey, em2 - 1, ed, 23, 59, 59)
                              startIso = s.toISOString()
                              endIso = e.toISOString()
                            } else {
                              startIso = s.toISOString()
                            }
                          } else {
                            const e = new Date(sy, sm - 1, sd, 23, 59, 59)
                            startIso = s.toISOString()
                            endIso = e.toISOString()
                          }
                        } else {
                          // non-allDay: use times if provided, otherwise default
                          const [sh, smn] = (payload.startTime || '09:00').split(':').map((s) => parseInt(s, 10))
                          const [eh, emn] = (payload.endTime || payload.startTime || '10:00').split(':').map((s) => parseInt(s, 10))
                          const s = new Date(sy, sm - 1, sd, Number.isNaN(sh) ? 9 : sh, Number.isNaN(smn) ? 0 : smn, 0)
                          let e: Date
                          if (payload.endDate) {
                            const [ey, em2, ed] = payload.endDate.split('-').map((s) => parseInt(s, 10))
                            if (!Number.isNaN(ey) && !Number.isNaN(em2) && !Number.isNaN(ed)) {
                              e = new Date(ey, em2 - 1, ed, Number.isNaN(eh) ? (s.getHours() + 1) : eh, Number.isNaN(emn) ? 0 : emn, 0)
                            } else {
                              e = new Date(sy, sm - 1, sd, Number.isNaN(eh) ? (s.getHours() + 1) : eh, Number.isNaN(emn) ? 0 : emn, 0)
                            }
                          } else {
                            e = new Date(sy, sm - 1, sd, Number.isNaN(eh) ? (s.getHours() + 1) : eh, Number.isNaN(emn) ? 0 : emn, 0)
                          }
                          startIso = s.toISOString()
                          endIso = e.toISOString()
                        }
                      }
                    } else if (payload.date) {
                      const day = new Date(payload.date)
                      if (payload.allDay) {
                        const s = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 0, 0, 0)
                        const e = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 23, 59, 59)
                        startIso = s.toISOString()
                        endIso = e.toISOString()
                      } else if (payload.startTime) {
                        const [sh, sm2] = (payload.startTime || '09:00').split(':').map((s) => parseInt(s, 10))
                        const [eh, em2] = (payload.endTime || payload.startTime || '10:00').split(':').map((s) => parseInt(s, 10))
                        const s = new Date(day.getFullYear(), day.getMonth(), day.getDate(), Number.isNaN(sh) ? 9 : sh, Number.isNaN(sm2) ? 0 : sm2, 0)
                        const e = new Date(day.getFullYear(), day.getMonth(), day.getDate(), Number.isNaN(eh) ? (s.getHours() + 1) : eh, Number.isNaN(em2) ? 0 : em2, 0)
                        startIso = s.toISOString()
                        endIso = e.toISOString()
                      } else {
                        startIso = day.toISOString()
                      }
                    }

                    const body = {
                      title: payload.title,
                      description: payload.description,
                      country: payload.country || null,
                      city: payload.city || null,
                      address: payload.address || null,
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
              {/* My-events modal opener */}
              <EventModal
                open={!!selectedMyEvent}
                event={selectedMyEvent}
                onClose={() => setSelectedMyEvent(null)}
                onUpdated={(updated) => {
                  if (!updated) return
                  setAdminEvents((prev) => (prev || []).map((e) => (String(e._id || e.id) === String(updated._id || updated.id) ? updated : e)))
                  setAttendingEvents((prev) => (prev || []).map((e) => (String(e._id || e.id) === String(updated._id || updated.id) ? updated : e)))
                  setSelectedMyEvent(null)
                }}
              />
              <AdminPhotosModal open={showAdminPhotos} event={selectedAdminPhotosEvent} onClose={() => setShowAdminPhotos(false)} />
              <PairUploadModal
                open={pairUploadOpen}
                event={pairUploadEvent}
                myPairs={Array.isArray(pairUploadEvent?.attendingPairs) ? pairUploadEvent.attendingPairs.filter((p: any) => String(p.club || p) === String(userId)) : []}
                onClose={() => { setPairUploadOpen(false); setPairUploadEvent(null) }}
                onUploaded={(updated) => {
                  if (!updated) return
                  setAttendingEvents((prev) => (prev || []).map((e) => (String(e._id || e.id) === String(updated._id || updated.id) ? updated : e)))
                }}
              />
              {openPairsForEvent && (
                <PairsSelectModal
                  open={!!openPairsForEvent}
                  initialSelected={(openPairsForEvent.attendingPairs || []).map((p: any) => String(p._id || p))}
                  onClose={() => setOpenPairsForEvent(null)}
                  onSave={handleSavePairsForEvent}
                />
              )}
              
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
                    if (payload.startDate) {
                      const [sy, sm, sd] = payload.startDate.split('-').map((s) => parseInt(s, 10))
                      if (!Number.isNaN(sy) && !Number.isNaN(sm) && !Number.isNaN(sd)) {
                        if (payload.allDay) {
                          const s = new Date(sy, sm - 1, sd, 0, 0, 0)
                          if (payload.endDate) {
                            const [ey, em2, ed] = payload.endDate.split('-').map((s) => parseInt(s, 10))
                            if (!Number.isNaN(ey) && !Number.isNaN(em2) && !Number.isNaN(ed)) {
                              const e = new Date(ey, em2 - 1, ed, 23, 59, 59)
                              startIso = s.toISOString()
                              endIso = e.toISOString()
                            } else {
                              startIso = s.toISOString()
                            }
                          } else {
                            const e = new Date(sy, sm - 1, sd, 23, 59, 59)
                            startIso = s.toISOString()
                            endIso = e.toISOString()
                          }
                        } else {
                          const [sh, smn] = (payload.startTime || '09:00').split(':').map((s) => parseInt(s, 10))
                          const [eh, emn] = (payload.endTime || payload.startTime || '10:00').split(':').map((s) => parseInt(s, 10))
                          const s = new Date(sy, sm - 1, sd, Number.isNaN(sh) ? 9 : sh, Number.isNaN(smn) ? 0 : smn, 0)
                          let e: Date
                          if (payload.endDate) {
                            const [ey, em2, ed] = payload.endDate.split('-').map((s) => parseInt(s, 10))
                            if (!Number.isNaN(ey) && !Number.isNaN(em2) && !Number.isNaN(ed)) {
                              e = new Date(ey, em2 - 1, ed, Number.isNaN(eh) ? (s.getHours() + 1) : eh, Number.isNaN(emn) ? 0 : emn, 0)
                            } else {
                              e = new Date(sy, sm - 1, sd, Number.isNaN(eh) ? (s.getHours() + 1) : eh, Number.isNaN(emn) ? 0 : emn, 0)
                            }
                          } else {
                            e = new Date(sy, sm - 1, sd, Number.isNaN(eh) ? (s.getHours() + 1) : eh, Number.isNaN(emn) ? 0 : emn, 0)
                          }
                          startIso = s.toISOString()
                          endIso = e.toISOString()
                        }
                      }
                    } else if (payload.date) {
                      const day = new Date(payload.date)
                      if (payload.allDay) {
                        const s = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 0, 0, 0)
                        const e = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 23, 59, 59)
                        startIso = s.toISOString()
                        endIso = e.toISOString()
                      } else if (payload.startTime) {
                        const [sh, sm2] = (payload.startTime || '09:00').split(':').map((s) => parseInt(s, 10))
                        const [eh, em2] = (payload.endTime || payload.startTime || '10:00').split(':').map((s) => parseInt(s, 10))
                        const s = new Date(day.getFullYear(), day.getMonth(), day.getDate(), Number.isNaN(sh) ? 9 : sh, Number.isNaN(sm2) ? 0 : sm2, 0)
                        const e = new Date(day.getFullYear(), day.getMonth(), day.getDate(), Number.isNaN(eh) ? (s.getHours() + 1) : eh, Number.isNaN(em2) ? 0 : em2, 0)
                        startIso = s.toISOString()
                        endIso = e.toISOString()
                      } else {
                        startIso = day.toISOString()
                      }
                    }

                    const body = {
                      title: payload.title,
                      description: payload.description,
                      country: payload.country || null,
                      city: payload.city || null,
                      address: payload.address || null,
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
              <DayModal open={showDayModal} date={selectedDate} onClose={() => setShowDayModal(false)} role={role} currentUserId={currentUserId} onCreate={(d) => {
                // Prevent dancers and clubs from creating events via DayModal
                const rl = String(role || '').toLowerCase()
                if (rl === 'dansator' || rl === 'club') return
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
