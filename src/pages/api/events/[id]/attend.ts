import type { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../../auth/[...nextauth]'
import dbConnect from '../../../../lib/mongoose'
import Event from '../../../../models/Event'
import Pair from '../../../../models/Pair'
import User from '../../../../models/User'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions as any)
  if (!session) return res.status(401).json({ message: 'Unauthorized' })
  const userId = (session as any)?.user?.id
  if (!userId) return res.status(401).json({ message: 'Unauthorized' })

  const { id } = req.query
  if (!id || Array.isArray(id)) return res.status(400).json({ message: 'Invalid event id' })

  await dbConnect()

  if (req.method === 'POST') {
    // add current user to attendees
    try {
      const body = req.body || {}

      // If pairIds provided, treat as club adding pairs (existing flow)
      if (Array.isArray(body.pairIds) && body.pairIds.length > 0) {
        // ensure the pairs belong to this user (club)
        const pairs = await Pair.find({ _id: { $in: body.pairIds }, club: userId }).select('_id').lean()
  const validIds = pairs.map((p) => String(p._id))
        if (validIds.length === 0) return res.status(403).json({ message: 'No valid pairs to add' })
        const toAdd = body.pairIds.filter((pid: string) => validIds.includes(String(pid)))
        const ev = await Event.findByIdAndUpdate(id, { $addToSet: { attendingPairs: { $each: toAdd } } }, { new: true })
        if (!ev) return res.status(404).json({ message: 'Event not found' })
        const populated = await Event.findById(ev._id).populate('user', 'firstName lastName email').populate('attendingPairs', 'partner1 partner2 pairCategory classLevel coach club').populate('judges', 'firstName lastName email').lean()
        return res.status(200).json({ ok: true, event: populated })
      }

      // If request has { user: true } or { judge: true }, allow a judge to register solo
      if (body.user === true || body.judge === true) {
        const user = await User.findById(userId).select('role').lean()
        const role = String(user?.role || '').toLowerCase()
        if (!(role === 'arbitru' || role === 'judge')) return res.status(403).json({ message: 'Only judges can register solo' })
        const ev = await Event.findByIdAndUpdate(id, { $addToSet: { judges: userId } }, { new: true })
        if (!ev) return res.status(404).json({ message: 'Event not found' })
        const populated = await Event.findById(ev._id).populate('user', 'firstName lastName email').populate('attendingPairs', 'partner1 partner2 pairCategory classLevel coach club').populate('judges', 'firstName lastName email').lean()
        return res.status(200).json({ ok: true, event: populated })
      }

      return res.status(400).json({ message: 'pairIds or user required' })
    } catch (err) {
      console.error('[api/events/attend] add error', err)
      return res.status(500).json({ message: 'Server error' })
    }
  }

  if (req.method === 'DELETE') {
    // remove current user from attendees
    try {
      const body = req.body || {}
      // club removing pairs
      if (Array.isArray(body.pairIds) && body.pairIds.length > 0) {
        const pairs = await Pair.find({ _id: { $in: body.pairIds }, club: userId }).select('_id').lean()
  const validIds = pairs.map((p) => String(p._id))
        if (validIds.length === 0) return res.status(403).json({ message: 'No valid pairs to remove' })
        const toRemove = body.pairIds.filter((pid: string) => validIds.includes(String(pid)))
        const ev = await Event.findByIdAndUpdate(id, { $pull: { attendingPairs: { $in: toRemove } } }, { new: true })
        if (!ev) return res.status(404).json({ message: 'Event not found' })
        const populated = await Event.findById(ev._id).populate('user', 'firstName lastName email').populate('attendingPairs', 'partner1 partner2 pairCategory classLevel coach club').populate('judges', 'firstName lastName email').lean()
        return res.status(200).json({ ok: true, event: populated })
      }

      // judge removing themselves
      if (body.user === true || body.judge === true) {
        const user = await User.findById(userId).select('role').lean()
        const role = String(user?.role || '').toLowerCase()
        if (!(role === 'arbitru' || role === 'judge')) return res.status(403).json({ message: 'Only judges can remove themselves' })
        const ev = await Event.findByIdAndUpdate(id, { $pull: { judges: userId } }, { new: true })
        if (!ev) return res.status(404).json({ message: 'Event not found' })
        const populated = await Event.findById(ev._id).populate('user', 'firstName lastName email').populate('attendingPairs', 'partner1 partner2 pairCategory classLevel coach club').populate('judges', 'firstName lastName email').lean()
        return res.status(200).json({ ok: true, event: populated })
      }

      return res.status(400).json({ message: 'pairIds or user required' })
    } catch (err) {
      console.error('[api/events/attend] remove error', err)
      return res.status(500).json({ message: 'Server error' })
    }
  }

  return res.status(405).end()
}
