import type { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../auth/[...nextauth]'
import dbConnect from '../../../lib/mongoose'
import Pair from '../../../models/Pair'
import User from '../../../models/User'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions as any)
  if (!session) return res.status(401).json({ message: 'Unauthorized' })

  const userId = (session as any)?.user?.id
  if (!userId) return res.status(401).json({ message: 'Unauthorized' })

  try {
    await dbConnect()
    if (req.method === 'GET') {
      // club users see their pairs; admins see all
      const role = (session as any)?.user?.role || ''
      const query: any = {}
      if ((role || '').toLowerCase() === 'club') query.club = userId
      // support ?populate=true to include club user fields for client convenience
      if (String(req.query.populate) === 'true') {
        const pairs = await Pair.find(query).sort({ createdAt: -1 }).populate('club', 'clubName fullName email').lean()
        return res.status(200).json({ ok: true, pairs })
      }
      const pairs = await Pair.find(query).sort({ createdAt: -1 }).lean()
      return res.status(200).json({ ok: true, pairs })
    }

    if (req.method === 'POST') {
      const body = req.body || {}
      const club = userId
      // ageCategory is selected by the user in the UI; do not auto-compute here
      const p = new Pair({
        club,
        pairCategory: body.pairCategory || body.category || '',
        coach: body.coach || '',
        ageCategory: body.ageCategory || '',
        classLevel: body.classLevel || '',
        discipline: body.discipline || (Array.isArray(body.styles) ? body.styles[0] : (body.styles || '')),
        partner1: {
          fullName: body.partner1FullName || body.partnerA || '',
          birthday: body.partner1Birthday || null,
          licenseNumber: body.partner1License || '',
          minWdsf: body.partner1MinWdsf || null,
        },
        partner2: {
          fullName: body.partner2FullName || body.partnerB || '',
          birthday: body.partner2Birthday || null,
          licenseNumber: body.partner2License || '',
          minWdsf: body.partner2MinWdsf || null,
        },
      })
      await p.save()
      // add reference to user's pairs array for quick lookup
      try {
        await User.findByIdAndUpdate(userId, { $addToSet: { pairs: p._id } }).exec()
      } catch (e) {
        console.error('[api/pairs] failed to add pair to user.pairs', e)
      }
      return res.status(201).json({ ok: true, pair: p })
    }

    return res.status(405).end()
  } catch (err) {
    console.error('[api/pairs] error', err)
    return res.status(500).json({ message: 'Server error' })
  }
}
