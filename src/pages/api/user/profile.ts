import type { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../auth/[...nextauth]'
import dbConnect from '../../../lib/mongoose'
import User from '../../../models/User'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET' && req.method !== 'PUT') return res.status(405).end()

  const session = await getServerSession(req, res, authOptions as any)
  if (!session) return res.status(401).json({ message: 'Unauthorized' })

  const userId = (session as any)?.user?.id
  if (!userId) return res.status(401).json({ message: 'Unauthorized' })

  try {
    await dbConnect()
    if (req.method === 'GET') {
      const user = await User.findById(userId).select('firstName lastName fullName email birthday role cardNumber').lean()
      if (!user) return res.status(404).json({ message: 'Not found' })
      return res.status(200).json({ ok: true, user })
    }

    // PUT - update profile
    const body = req.body || {}
    const allowed: any = {}
    if (typeof body.firstName === 'string') allowed.firstName = body.firstName
    if (typeof body.lastName === 'string') allowed.lastName = body.lastName
    if (typeof body.email === 'string') allowed.email = body.email.toLowerCase().trim()
    if (typeof body.cardNumber === 'string') allowed.cardNumber = body.cardNumber
    if (typeof body.birthday === 'string' && body.birthday) allowed.birthday = new Date(body.birthday)

    if (allowed.firstName || allowed.lastName) {
      const fn = allowed.firstName !== undefined ? allowed.firstName : undefined
      const ln = allowed.lastName !== undefined ? allowed.lastName : undefined
      allowed.fullName = `${fn || ''} ${ln || ''}`.trim()
    }

    try {
      const updated = await User.findByIdAndUpdate(userId, { $set: allowed }, { new: true }).select('firstName lastName fullName email birthday role cardNumber').lean()
      if (!updated) return res.status(404).json({ message: 'Not found' })
      return res.status(200).json({ ok: true, user: updated })
    } catch (err: any) {
      console.error('[api/user/profile] update error', err)
      if (err.code === 11000) return res.status(422).json({ message: 'Email already in use' })
      return res.status(500).json({ message: 'Server error' })
    }
  } catch (err) {
    console.error('[api/user/profile] error', err)
    return res.status(500).json({ message: 'Server error' })
  }
}
