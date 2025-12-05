import type { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../auth/[...nextauth]'
import dbConnect from '../../../lib/mongoose'
import Event from '../../../models/Event'
import User from '../../../models/User'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // session may be null for public GETs (guests)
  const session = await getServerSession(req, res, authOptions as any)
  const userId = (session as any)?.user?.id || null

  const { id } = req.query
  if (!id || Array.isArray(id)) return res.status(400).json({ message: 'Invalid id' })

  await dbConnect()

  if (req.method === 'GET') {
    try {
      const ev = await Event.findById(id)
        .populate('user', 'firstName lastName email')
        .populate('attendingPairs', 'partner1 partner2 pairCategory classLevel coach club')
        .populate('judges', 'firstName lastName email')
        .lean()
      if (!ev) return res.status(404).json({ message: 'Not found' })
      return res.status(200).json({ ok: true, event: ev })
    } catch (err) {
      console.error('[api/events/[id]] GET error', err)
      return res.status(500).json({ message: 'Server error' })
    }
  }

  if (req.method === 'PUT' || req.method === 'PATCH') {
    // require authenticated user for modifications
    if (!userId) return res.status(401).json({ message: 'Unauthorized' })
    try {
      const body = req.body || {}
      const ev = await Event.findById(id).lean()
      if (!ev) return res.status(404).json({ message: 'Event not found' })

      // allow update if user is creator or admin/arbitru
      const user = await User.findById(userId).select('role').lean()
      const role = String(user?.role || '').toLowerCase()
      if (String(ev.user) !== String(userId) && !(role.includes('admin') || role.includes('arbitru'))) {
        return res.status(403).json({ message: 'Forbidden' })
      }

      const update: any = {}
      if (body.title !== undefined) update.title = body.title
      if (body.description !== undefined) update.description = body.description
    if (body.eventType !== undefined) update.eventType = body.eventType
  if (body.country !== undefined) update.country = body.country
  if (body.city !== undefined) update.city = body.city
  if (body.address !== undefined) update.address = body.address
      if (body.allDay !== undefined) update.allDay = !!body.allDay
      if (body.start !== undefined) update.start = body.start ? new Date(body.start) : null
      if (body.end !== undefined) update.end = body.end ? new Date(body.end) : null

  const updatedRaw = await Event.findByIdAndUpdate(id, { $set: update }, { new: true })
  // populate user, attendingPairs and judges for the response
  const updated = await Event.findById(updatedRaw._id).populate('user', 'firstName lastName email').populate('attendingPairs', 'partner1 partner2 pairCategory classLevel coach club').populate('judges', 'firstName lastName email').lean()
  return res.status(200).json({ ok: true, event: updated })
    } catch (err) {
      console.error('[api/events/[id]] PUT error', err)
      return res.status(500).json({ message: 'Server error' })
    }
  }

  if (req.method === 'DELETE') {
    try {
      if (!userId) return res.status(401).json({ message: 'Unauthorized' })
      const ev = await Event.findById(req.query.id).lean()
      if (!ev) return res.status(404).json({ message: 'Not found' })
      const user = await User.findById(userId).select('role').lean()
      const role = String(user?.role || '').toLowerCase()
      if (String(ev.user) !== String(userId) && !(role.includes('admin') || role.includes('arbitru'))) {
        return res.status(403).json({ message: 'Forbidden' })
      }
      await Event.findByIdAndDelete(id)
      return res.status(200).json({ ok: true })
    } catch (err) {
      console.error('[api/events/[id]] DELETE error', err)
      return res.status(500).json({ message: 'Server error' })
    }
  }

  res.setHeader('Allow', ['GET', 'PUT', 'PATCH', 'DELETE'])
  return res.status(405).end(`Method ${req.method} Not Allowed`)
}
