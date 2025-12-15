import type { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession, Session } from 'next-auth'
import { authOptions } from '../auth/[...nextauth]'
import dbConnect from '../../../lib/mongoose'
import Event from '../../../models/Event'
import User from '../../../models/User'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const session = (await getServerSession(req, res, authOptions)) as Session | null

    // Check if user is authenticated and has admin role
    if (!session || !session.user) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const adminRole = ((session.user as any).role || '').toLowerCase()
    if (!adminRole.includes('admin')) {
      return res.status(403).json({ error: 'Forbidden: Admin role required' })
    }

    const { eventId } = req.body

    if (!eventId) {
      return res.status(400).json({ error: 'eventId is required' })
    }

    await dbConnect()

    // Get admin user's ID from User model
    const adminUser = await User.findOne({ email: session.user.email })
    if (!adminUser) {
      return res.status(404).json({ error: 'Admin user not found' })
    }

    // Delete the event from database
    const deletedEvent = await Event.findByIdAndDelete(eventId)

    if (!deletedEvent) {
      return res.status(404).json({ error: 'Event not found' })
    }

    res.status(200).json({
      message: 'Event rejected and deleted successfully',
      event: deletedEvent,
    })
  } catch (error) {
    console.error('Error rejecting event:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
}
