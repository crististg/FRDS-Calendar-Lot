import type { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../auth/[...nextauth]'
import dbConnect from '../../../lib/mongoose'
import Pair from '../../../models/Pair'
import mongoose from 'mongoose'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions as any)
  if (!session) return res.status(401).json({ message: 'Unauthorized' })

  const userId = (session as any)?.user?.id
  if (!userId) return res.status(401).json({ message: 'Unauthorized' })

  const { id } = req.query
  if (!id || Array.isArray(id)) return res.status(400).json({ message: 'Bad request' })
  if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ message: 'Invalid id' })

  try {
    await dbConnect()
    const pair = await Pair.findById(id)
    if (!pair) return res.status(404).json({ message: 'Not found' })

    const role = (session as any)?.user?.role || ''
    const owner = String(pair.club)
    const isOwner = String(userId) === owner
    const isAdmin = (role || '').toLowerCase().includes('admin')
    if (req.method === 'GET') {
      return res.status(200).json({ ok: true, pair })
    }

    if (req.method === 'PUT') {
      if (!isOwner && !isAdmin) return res.status(403).json({ message: 'Forbidden' })
      const body = req.body || {}
      pair.partner1 = pair.partner1 || {}
      pair.partner2 = pair.partner2 || {}
      pair.partner1.fullName = body.partner1FullName || body.partnerA || pair.partner1.fullName
      pair.partner1.birthday = body.partner1Birthday || pair.partner1.birthday
      pair.partner1.licenseNumber = body.partner1License || pair.partner1.licenseNumber
      pair.partner2.fullName = body.partner2FullName || body.partnerB || pair.partner2.fullName
      pair.partner2.birthday = body.partner2Birthday || pair.partner2.birthday
      pair.partner2.licenseNumber = body.partner2License || pair.partner2.licenseNumber

      // compute derived category from birthdays if explicit not provided
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

      const derivedCategory = computeCategoryFromBirthdays(body.partner1Birthday || pair.partner1?.birthday, body.partner2Birthday || pair.partner2?.birthday)
      pair.pairCategory = body.pairCategory || body.category || derivedCategory || pair.pairCategory
      pair.coach = body.coach || pair.coach
      pair.ageCategory = body.ageCategory || pair.ageCategory
      pair.classLevel = body.classLevel || pair.classLevel
      pair.styles = Array.isArray(body.styles) ? body.styles : (body.styles ? [body.styles] : pair.styles)
      await pair.save()
      return res.status(200).json({ ok: true, pair })
    }

    if (req.method === 'DELETE') {
      if (!isOwner && !isAdmin) return res.status(403).json({ message: 'Forbidden' })
      const pid = pair._id
      await pair.deleteOne()
      try {
        // remove reference from user's pairs array
        const User = (await import('../../../models/User')).default
        await User.findByIdAndUpdate(owner, { $pull: { pairs: pid } }).exec()
      } catch (e) {
        console.error('[api/pairs/[id]] failed to remove pair from user.pairs', e)
      }
      return res.status(200).json({ ok: true })
    }

    return res.status(405).end()
  } catch (err) {
    console.error('[api/pairs/[id]] error', err)
    return res.status(500).json({ message: 'Server error' })
  }
}
