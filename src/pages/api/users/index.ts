import type { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../auth/[...nextauth]'
import dbConnect from '../../../lib/mongoose'
import User from '../../../models/User'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const session = await getServerSession(req, res, authOptions as any)
  if (!session) return res.status(401).json({ error: 'Unauthorized' })
  const userId = (session as any)?.user?.id
  if (!userId) return res.status(401).json({ error: 'Unauthorized' })

  try {
    await dbConnect()

    // restrict to admin / judge / arbitru roles
    const me = await User.findById(userId).select('role').lean()
    const role = String(me?.role || '').toLowerCase()
    const allowed = role.includes('admin') || role.includes('arbitru') || role.includes('judge')
    if (!allowed) return res.status(403).json({ error: 'Forbidden' })

    const q = String(req.query.q || '').trim()
    const limit = Math.min(200, Number(req.query.limit) || 50)

    const filter: any = {}
    if (q) {
      const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
      filter.$or = [
        { email: re },
        { firstName: re },
        { lastName: re },
        { fullName: re },
        { cardNumber: re },
      ]
    }

  // include clubName for club accounts so the client can display club names
  const users = await User.find(filter).select('firstName lastName fullName email role cardNumber clubName').limit(limit).lean()
    return res.status(200).json({ users })
  } catch (err) {
    console.error('[api/users] error', err)
    return res.status(500).json({ error: 'Server error' })
  }
}
