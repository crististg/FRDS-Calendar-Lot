import type { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../auth/[...nextauth]'
import dbConnect from '../../../lib/mongoose'
import User from '../../../models/User'
import Event from '../../../models/Event'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions as any)
  if (!session) return res.status(401).json({ message: 'Unauthorized' })

  const userId = (session as any)?.user?.id
  if (!userId) return res.status(401).json({ message: 'Unauthorized' })

  await dbConnect()

  if (req.method === 'GET') {
    // optional ?from=YYYY-MM-DD&to=YYYY-MM-DD
    // optional ?attending=true to get events current user attends
    // optional ?mine=true to get events created by the current user
    // optional ?all=true&populate=true for admin to get all events and populate attendees/user
    // default: return all events for the provided range (public to all users)
  const { from, to, attending, mine, all, populate, overlap } = req.query
  const q: any = {}

    // admin 'all' requires role check
    if (String(all) === 'true') {
      // ensure the requesting user is an admin (or 'arbitru' role)
      const user = await User.findById(userId).select('role').lean()
      const role = (user?.role || '').toLowerCase()
      if (!(role.includes('admin') || role.includes('arbitru'))) return res.status(403).json({ message: 'Forbidden' })
      // no filter; q remains {}
    } else if (String(attending) === 'true') {
      q.attendees = userId
    } else if (String(mine) === 'true') {
      q.user = userId
    } else {
      // no user filter -> all events
    }

    // support both start-range queries and overlap queries
    if (String(overlap) === 'true' && (from || to)) {
      // overlap=true means: return events that overlap the provided [from, to] range
      // i.e. event.start <= to && (event.end >= from OR event.end is null/undefined)
      const fromDate = from ? new Date(String(from)) : undefined
      const toDate = to ? new Date(String(to)) : undefined
      if (toDate) q.start = { $lte: toDate }
      // end may be null/undefined for single-date events, so use $or
      const or: any[] = []
      if (fromDate) or.push({ end: { $gte: fromDate } })
      or.push({ end: { $exists: false } })
      or.push({ end: null })
      q.$or = or
    } else if (from || to) {
      q.start = {}
      if (from) q.start.$gte = new Date(String(from))
      if (to) q.start.$lte = new Date(String(to))
    }

    if (String(populate) === 'true') {
      const events = await Event.find(q).sort({ start: 1 }).populate('attendees', 'firstName lastName email').populate('user', 'firstName lastName email').lean()
      return res.status(200).json({ ok: true, events })
    }

    const events = await Event.find(q).sort({ start: 1 }).lean()
    return res.status(200).json({ ok: true, events })
  }

  if (req.method === 'POST') {
    try {
      const body = req.body || {}
      // ensure user role isn't dansator
      const user = await User.findById(userId).lean()
      if (!user) return res.status(401).json({ message: 'Unauthorized' })
      if ((user.role || '').toLowerCase() === 'dansator') return res.status(403).json({ message: 'Forbidden' })

      const { title, description, location, allDay, start, end } = body
      if (!title || !start) return res.status(422).json({ message: 'Missing required fields' })

      const startDate = new Date(start)
      const endDate = end ? new Date(end) : undefined

      const ev = new Event({
        user: userId,
        title,
        description,
        location,
        attendees: [userId],
        allDay: !!allDay,
        start: startDate,
        end: endDate,
      })
      await ev.save()
      return res.status(201).json({ ok: true, event: ev })
    } catch (err) {
      console.error('[api/events] create error', err)
      return res.status(500).json({ message: 'Server error' })
    }
  }

  return res.status(405).end()
}
