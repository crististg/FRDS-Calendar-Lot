import type { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../../auth/[...nextauth]'
import dbConnect from '../../../../lib/mongoose'
import Event from '../../../../models/Event'

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
      const ev = await Event.findByIdAndUpdate(id, { $addToSet: { attendees: userId } }, { new: true }).lean()
      if (!ev) return res.status(404).json({ message: 'Event not found' })
      return res.status(200).json({ ok: true, event: ev })
    } catch (err) {
      console.error('[api/events/attend] add error', err)
      return res.status(500).json({ message: 'Server error' })
    }
  }

  if (req.method === 'DELETE') {
    // remove current user from attendees
    try {
      const ev = await Event.findByIdAndUpdate(id, { $pull: { attendees: userId } }, { new: true }).lean()
      if (!ev) return res.status(404).json({ message: 'Event not found' })
      return res.status(200).json({ ok: true, event: ev })
    } catch (err) {
      console.error('[api/events/attend] remove error', err)
      return res.status(500).json({ message: 'Server error' })
    }
  }

  return res.status(405).end()
}
