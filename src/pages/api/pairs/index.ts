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
      // Helper to compute category based on older partner's age
      function computeCategoryFromBirthdays(b1: any, b2: any) {
        const toDate = (v: any) => {
          if (!v) return null
          const d = new Date(v)
          if (isNaN(d.getTime())) return null
          return d
        }
        const bd1 = toDate(b1)
        const bd2 = toDate(b2)
        if (!bd1 && !bd2) return null
        const now = new Date()
        const age = (bd: Date) => {
          let a = now.getFullYear() - bd.getFullYear()
          const m = now.getMonth() - bd.getMonth()
          if (m < 0 || (m === 0 && now.getDate() < bd.getDate())) a--
          return a
        }
        const ages: number[] = []
        if (bd1) ages.push(age(bd1))
        if (bd2) ages.push(age(bd2))
        const maxAge = Math.max(...ages)
        if (maxAge <= 9) return 'Sub-Juvenile'
        if (maxAge <= 11) return 'Juvenile'
        if (maxAge <= 13) return 'Junior 1'
        if (maxAge <= 15) return 'Junior 2'
        if (maxAge <= 18) return 'Youth'
        if (maxAge <= 32) return 'Adult'
        return 'Senior'
      }
      const derivedCategory = computeCategoryFromBirthdays(body.partner1Birthday || body.partner1?.birthday, body.partner2Birthday || body.partner2?.birthday)
      const p = new Pair({
        club,
        partner1: {
          fullName: body.partner1FullName || body.partnerA || '',
          birthday: body.partner1Birthday || null,
          licenseNumber: body.partner1License || '',
        },
        partner2: {
          fullName: body.partner2FullName || body.partnerB || '',
          birthday: body.partner2Birthday || null,
          licenseNumber: body.partner2License || '',
        },
        // prefer explicit pairCategory, fall back to derivedCategory when available
        pairCategory: body.pairCategory || body.category || derivedCategory || '',
        coach: body.coach || '',
        ageCategory: body.ageCategory || '',
        classLevel: body.classLevel || '',
        styles: Array.isArray(body.styles) ? body.styles : (body.styles ? [body.styles] : []),
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
