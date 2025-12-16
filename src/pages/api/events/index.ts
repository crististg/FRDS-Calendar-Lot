import type { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../auth/[...nextauth]'
import dbConnect from '../../../lib/mongoose'
import User from '../../../models/User'
import Event from '../../../models/Event'
import Pair from '../../../models/Pair'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions as any)
  const userId = (session as any)?.user?.id || null

  await dbConnect()
  // ensure Pair model is registered before populate is used
  void Pair

  if (req.method === 'GET') {
    // optional ?from=YYYY-MM-DD&to=YYYY-MM-DD
    // optional ?attending=true to get events current user attends
    // optional ?mine=true to get events created by the current user
    // optional ?all=true&populate=true for admin to get all events and populate attendees/user
    // default: return all events for the provided range (public to all users)
  const { from, to, attending, mine, all, populate, overlap, pending, isApproved } = req.query
  const q: any = {}
    // filter for pending approval status or explicit isApproved filter
    if (String(pending) === 'true') {
      q.isApproved = false
    } else if (String(isApproved) === 'true') {
      q.isApproved = true
    }

    // admin 'all' requires role check
    if (String(all) === 'true') {
      // ensure the requesting user is an admin (or 'arbitru' role)
      if (!userId) return res.status(401).json({ message: 'Unauthorized' })
      const user = await User.findById(userId).select('role').lean()
      const role = (user?.role || '').toLowerCase()
      if (!(role.includes('admin') || role.includes('arbitru'))) return res.status(403).json({ message: 'Forbidden' })
      // no filter; q remains {}
    } else if (String(attending) === 'true') {
      if (!userId) return res.status(401).json({ message: 'Unauthorized' })
      // For attendance, include events where any of the user's pairs are attending OR the user is registered as a judge.
      const user = await User.findById(userId).select('pairs').lean()
      const userPairIds = Array.isArray((user || {}).pairs) ? (user!.pairs as any[]) : []
      const or: any[] = []
      if (userPairIds && userPairIds.length > 0) or.push({ attendingPairs: { $in: userPairIds } })
      // include judge participation (user registered as judge)
      or.push({ judges: userId })
      // if there are multiple conditions combine with $or
      q.$or = or
    } else if (String(mine) === 'true') {
      if (!userId) return res.status(401).json({ message: 'Unauthorized' })
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

    // Filter by approval status unless user is admin or creator (skip if pending or explicit isApproved filter is active)
    if (String(pending) !== 'true' && String(isApproved) !== 'true') {
      if (!userId) {
        q.isApproved = true
      } else {
        const userRole = await User.findById(userId).select('role').lean()
        const role = (userRole?.role || '').toLowerCase()
        // Allow admin and arbitru to see all events
        if (!role.includes('admin') && !role.includes('arbitru')) {
          // For non-admin users, show only approved events or events they created
          q.$or = [{ isApproved: true }, { user: userId }]
        }
      }
    }

    if (String(populate) === 'true') {
      const events = await Event.find(q).sort({ start: 1 })
        .populate('user', 'firstName lastName email role')
        .populate('attendingPairs', 'partner1 partner2 pairCategory classLevel coach club')
        .populate('judges', 'firstName lastName email')
        .lean()
      return res.status(200).json({ ok: true, events })
    }


    const events = await Event.find(q).sort({ start: 1 }).lean()
    return res.status(200).json({ ok: true, events })
  }

  if (req.method === 'POST') {
    try {
      const body = req.body || {}
  // ensure user role isn't dansator or club (clubs shouldn't create events)
  const user = await User.findById(userId).lean()
  if (!user) return res.status(401).json({ message: 'Unauthorized' })
  const role = String(user.role || '').toLowerCase()
  if (role === 'dansator') return res.status(403).json({ message: 'Forbidden' })
      
      // Check if user is admin - only admins can create pre-approved events
      // Judges and clubs must have their events approved by admin
      const isAdmin = role.includes('admin')
      const isClub = role.includes('club')

  const { title, description, eventType, country, city, address, allDay, start, end } = body
      if (!title || !start) return res.status(422).json({ message: 'Missing required fields' })

      const startDate = new Date(start)
      const endDate = end ? new Date(end) : undefined

      const ev = new Event({
        user: userId,
        title,
        description,
        eventType: eventType || 'Open',
        country: country || null,
        city: city || null,
        address: address || null,
        allDay: !!allDay,
        start: startDate,
        end: endDate,
        isApproved: isAdmin ? true : false,
        approvedBy: isAdmin ? userId : null,
        approvedAt: isAdmin ? new Date() : null,
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
