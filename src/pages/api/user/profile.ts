import type { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../auth/[...nextauth]'
import dbConnect from '../../../lib/mongoose'
import User from '../../../models/User'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).end()

  const session = await getServerSession(req, res, authOptions as any)
  if (!session) return res.status(401).json({ message: 'Unauthorized' })

  const userId = (session as any)?.user?.id
  if (!userId) return res.status(401).json({ message: 'Unauthorized' })

  try {
    await dbConnect()
    const user = await User.findById(userId).select('firstName lastName fullName email birthday role cardNumber').lean()
    if (!user) return res.status(404).json({ message: 'Not found' })

    return res.status(200).json({ ok: true, user })
  } catch (err) {
    console.error('[api/user/profile] error', err)
    return res.status(500).json({ message: 'Server error' })
  }
}
