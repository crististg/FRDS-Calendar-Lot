'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/router'

interface PendingJudge {
  _id: string
  email: string
  fullName: string
  firstName?: string
  lastName?: string
  createdAt: string
}

interface PendingEvent {
  _id: string
  title: string
  description?: string
  user: {
    _id: string
    fullName: string
    firstName?: string
    lastName?: string
  }
  start: string
  createdAt: string
}

interface Props {
  onSwitchPanel?: (panel: 'calendar' | 'settings' | 'my-events' | 'admin' | 'statistics' | 'pairs' | 'approvals') => void
  onEventsChanged?: () => Promise<void>
}

export default function ApprovalPanel({ onSwitchPanel, onEventsChanged }: Props) {
  const { data: session } = useSession()
  const router = useRouter()
  const [pendingJudges, setPendingJudges] = useState<PendingJudge[]>([])
  const [pendingEvents, setPendingEvents] = useState<PendingEvent[]>([])
  const [pendingClubEvents, setPendingClubEvents] = useState<PendingEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!session || !(session.user as any).id) {
      router.push('/login')
      return
    }

    fetchPendingItems()
  }, [session, router])

  const fetchPendingItems = async () => {
    try {
      setLoading(true)
      setError(null)

      // Fetch pending judges (users with role including 'arbitru' and isApproved=false)
      const judgesRes = await fetch('/api/users?pending=true&role=arbitru')
      if (!judgesRes.ok) throw new Error('Failed to fetch pending judges')
      const judgesData = await judgesRes.json()
      setPendingJudges(judgesData.users || [])

      // Fetch pending events (events with isApproved=false)
      const eventsRes = await fetch('/api/events?pending=true&populate=true')
      if (!eventsRes.ok) throw new Error('Failed to fetch pending events')
      const eventsData = await eventsRes.json()
      const allEvents = eventsData.events || []
      
      // Split events: club-created vs others
      const clubEvents = allEvents.filter((e: any) => {
        const userRole = (e.user?.role || '').toLowerCase()
        return userRole.includes('club')
      })
      const otherEvents = allEvents.filter((e: any) => {
        const userRole = (e.user?.role || '').toLowerCase()
        return !userRole.includes('club')
      })
      
      setPendingClubEvents(clubEvents)
      setPendingEvents(otherEvents)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      setError(message)
      console.error('Error fetching pending items:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleApproveJudge = async (judgeId: string) => {
    try {
      const res = await fetch('/api/admin/approve-judge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ judgeId }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to approve judge')
      }

      // Remove from list
      setPendingJudges((prev) => prev.filter((j) => j._id !== judgeId))
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      setError(message)
      console.error('Error approving judge:', err)
    }
  }

  const handleRejectJudge = async (judgeId: string) => {
    try {
      const res = await fetch('/api/admin/reject-judge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ judgeId }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to reject judge')
      }

      // Remove from list
      setPendingJudges((prev) => prev.filter((j) => j._id !== judgeId))
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      setError(message)
      console.error('Error rejecting judge:', err)
    }
  }

  const handleApproveEvent = async (eventId: string) => {
    try {
      const res = await fetch('/api/admin/approve-event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to approve event')
      }

      // Remove from both lists (could be in either based on creator role)
      setPendingClubEvents((prev) => prev.filter((e) => e._id !== eventId))
      setPendingEvents((prev) => prev.filter((e) => e._id !== eventId))
      
      // Refetch calendar events to show updated data
      if (onEventsChanged) {
        await onEventsChanged()
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      setError(message)
      console.error('Error approving event:', err)
    }
  }

  const handleRejectEvent = async (eventId: string) => {
    try {
      const res = await fetch('/api/admin/reject-event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to reject event')
      }

      // Remove from both lists (could be in either based on creator role)
      setPendingClubEvents((prev) => prev.filter((e) => e._id !== eventId))
      setPendingEvents((prev) => prev.filter((e) => e._id !== eventId))
      
      // Refetch calendar events to show updated data
      if (onEventsChanged) {
        await onEventsChanged()
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      setError(message)
      console.error('Error rejecting event:', err)
    }
  }

  if (loading) {
    return <div className="p-4 text-center text-gray-500">Se încarcă...</div>
  }

  return (
    <div className="p-6 space-y-8">
      <h2 className="text-2xl font-bold text-gray-800">Aprobare Conținut</h2>

      {error && (
        <div className="p-4 bg-red-100 text-red-700 rounded">
          {error}
        </div>
      )}

      <section>
        <h3 className="text-xl font-semibold text-gray-700 mb-4">
          Arbitri în așteptare ({pendingJudges.length})
        </h3>
        {pendingJudges.length === 0 ? (
          <p className="text-gray-500">Nu sunt arbitri în așteptare</p>
        ) : (
          <div className="space-y-3">
            {pendingJudges.map((judge) => (
              <div
                key={judge._id}
                className="flex items-center justify-between p-4 bg-gray-50 border border-gray-200 rounded-lg"
              >
                <div>
                  <p className="font-medium text-gray-800">
                    {judge.fullName || `${judge.firstName || ''} ${judge.lastName || ''}`.trim()}
                  </p>
                  <p className="text-sm text-gray-500">{judge.email}</p>
                  <p className="text-xs text-gray-400">
                    {new Date(judge.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleApproveJudge(judge._id)}
                    className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 cursor-pointer"
                  >
                    Aproba
                  </button>
                  <button
                    onClick={() => handleRejectJudge(judge._id)}
                    className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 cursor-pointer"
                  >
                    Respinge
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Pending Events Section */}
      <section>
        <h3 className="text-xl font-semibold text-gray-700 mb-4">
          Solicitări de Participare ({pendingClubEvents.length})
        </h3>
        {pendingClubEvents.length === 0 ? (
          <p className="text-gray-500">Nu sunt solicitări de participare de la cluburi</p>
        ) : (
          <div className="space-y-3">
            {pendingClubEvents.map((event) => (
              <div
                key={event._id}
                className="flex items-center justify-between p-4 bg-gray-50 border border-gray-200 rounded-lg"
              >
                <div>
                  <p className="font-medium text-gray-800">{event.title}</p>
                  {event.description && (
                    <p className="text-sm text-gray-600">{event.description}</p>
                  )}
                  <p className="text-sm text-gray-500">
                    Creat de:{' '}
                    {event.user.fullName ||
                      `${event.user.firstName || ''} ${event.user.lastName || ''}`.trim()}
                  </p>
                  <p className="text-xs text-gray-400">
                    Data: {new Date(event.start).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleApproveEvent(event._id)}
                    className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 cursor-pointer"
                  >
                    Creeaza eveniment
                  </button>
                  <button
                    onClick={() => handleRejectEvent(event._id)}
                    className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 cursor-pointer"
                  >
                    Respinge
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
      <section>
        <h3 className="text-xl font-semibold text-gray-700 mb-4">
          Evenimente în așteptare ({pendingEvents.length})
        </h3>
        {pendingEvents.length === 0 ? (
          <p className="text-gray-500">Nu sunt evenimente în așteptare</p>
        ) : (
          <div className="space-y-3">
            {pendingEvents.map((event) => (
              <div
                key={event._id}
                className="flex items-center justify-between p-4 bg-gray-50 border border-gray-200 rounded-lg"
              >
                <div>
                  <p className="font-medium text-gray-800">{event.title}</p>
                  {event.description && (
                    <p className="text-sm text-gray-600">{event.description}</p>
                  )}
                  <p className="text-sm text-gray-500">
                    Creat de:{' '}
                    {event.user.fullName ||
                      `${event.user.firstName || ''} ${event.user.lastName || ''}`.trim()}
                  </p>
                  <p className="text-xs text-gray-400">
                    Data: {new Date(event.start).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleApproveEvent(event._id)}
                    className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 cursor-pointer"
                  >
                    Aproba
                  </button>
                  <button
                    onClick={() => handleRejectEvent(event._id)}
                    className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 cursor-pointer"
                  >
                    Respinge
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
