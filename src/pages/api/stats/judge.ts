import type { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../auth/[...nextauth]'
import dbConnect from '../../../lib/mongoose'
import Event from '../../../models/Event'
import User from '../../../models/User'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions as any)
  if (!session) return res.status(401).json({ message: 'Unauthorized' })
  const userId = (session as any)?.user?.id
  if (!userId) return res.status(401).json({ message: 'Unauthorized' })

  await dbConnect()

  // Only allow judges/arbitru (and admins) to view their stats
  const user = await User.findById(userId).select('role').lean()
  const role = String(user?.role || '').toLowerCase()
  if (!(role.includes('arbitru') || role.includes('judge') || role.includes('admin'))) {
    return res.status(403).json({ message: 'Forbidden' })
  }

  try {
    const now = new Date()
    const year = now.getFullYear()
    const startOfYear = new Date(year, 0, 1, 0, 0, 0)
    const endOfYear = new Date(year, 11, 31, 23, 59, 59, 999)

  // Find events where the user is registered as a judge (new model) or legacy attendee, and the event overlaps the current year
  // Support both: Event.judges (preferred) and legacy Event.attendees
  const q: any = { $or: [{ judges: userId }, { attendees: userId }] }
    // event.start <= endOfYear AND (event.end >= startOfYear OR no end)
    q.start = { $lte: endOfYear }
    q.$or = [{ end: { $gte: startOfYear } }, { end: { $exists: false } }, { end: null }]

    const events = await Event.find(q).sort({ start: 1 }).lean()

    // Build country counts
    const countryCounts: Record<string, number> = {}
    for (const ev of events) {
      const c = (ev.country || 'Unknown').trim() || 'Unknown'
      countryCounts[c] = (countryCounts[c] || 0) + 1
    }

    return res.status(200).json({ ok: true, year, total: events.length, events: events.map((e) => ({ _id: e._id, title: e.title, start: e.start, end: e.end, country: e.country || null, city: e.city || null, address: e.address || null })), countries: countryCounts })
  } catch (err) {
    console.error('[api/stats/judge] error', err)
    return res.status(500).json({ message: 'Server error' })
  }
}
