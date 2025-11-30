import type { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../../auth/[...nextauth]'
import dbConnect from '../../../../lib/mongoose'
import mongoose from 'mongoose'
import Event from '../../../../models/Event'
import User from '../../../../models/User'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions as any)
  if (!session) return res.status(401).json({ message: 'Unauthorized' })
  const userId = (session as any)?.user?.id
  if (!userId) return res.status(401).json({ message: 'Unauthorized' })

  const { id } = req.query
  if (!id || Array.isArray(id)) return res.status(400).json({ message: 'Invalid id' })

  await dbConnect()

  if (req.method === 'POST') {
    try {
      const body = req.body || {}
      const ev = await Event.findById(id).populate('attendingPairs', 'club')
      if (!ev) return res.status(404).json({ message: 'Event not found' })

      // permission: allow if user is creator, admin/arbitru, or a club that owns the pair
      const user = await User.findById(userId).select('role').lean()
      const role = String(user?.role || '').toLowerCase()
      const isCreator = String(ev.user) === String(userId)
      let isClubUploader = false
      if (Array.isArray(ev.attendingPairs) && ev.attendingPairs.length) {
        isClubUploader = ev.attendingPairs.some((p: any) => String((p as any).club) === String(userId))
      }

      // if not creator and not admin/arbitru and not a club uploader -> forbidden
      if (!isCreator && !(role.includes('admin') || role.includes('arbitru')) && !isClubUploader) {
        return res.status(403).json({ message: 'Forbidden' })
      }

      // if uploader is a club (and not the event creator), require pairId and ensure the pair belongs to the club
      if (!isCreator && isClubUploader) {
        if (!body.pairId) return res.status(400).json({ message: 'pairId required for club uploads' })
        const matching = Array.isArray(ev.attendingPairs) ? ev.attendingPairs.find((p: any) => String(p._id || p) === String(body.pairId)) : null
        if (!matching) return res.status(400).json({ message: 'Pair not attending this event' })
        if (String((matching as any).club) !== String(userId)) return res.status(403).json({ message: 'Forbidden for this pair' })
      }

      const resultEntry: any = {
        createdAt: new Date(),
        createdBy: userId,
      }

      if (body.pairId) {
        try {
          resultEntry.pairId = new mongoose.Types.ObjectId(body.pairId)
        } catch (e) {
          resultEntry.pairId = body.pairId
        }
      }
      if (body.place !== undefined && body.place !== null && body.place !== '') {
        const n = Number(body.place)
        if (!Number.isNaN(n)) resultEntry.place = n
      }
      if (body.round) resultEntry.round = String(body.round)
      if (body.category) resultEntry.category = String(body.category)
      if (body.score !== undefined && body.score !== null && body.score !== '') {
        const n2 = Number(body.score)
        if (!Number.isNaN(n2)) resultEntry.score = n2
      }

      // push and save, then return the saved subdocument (with _id)
      ev.results = (ev.results || []).concat([resultEntry])
      await ev.save()
      const saved = ev.results && ev.results.length ? ev.results[ev.results.length - 1] : resultEntry
      return res.status(200).json({ ok: true, result: saved })
    } catch (err) {
      console.error('[api/events/[id]/results] POST error', err)
      return res.status(500).json({ message: 'Server error' })
    }
  }

  // DELETE /api/events/:id/results?resultId=...  -> remove a result entry
  if (req.method === 'DELETE') {
    try {
      const { resultId } = req.query as { resultId?: string }
      if (!resultId) return res.status(400).json({ message: 'resultId required' })
      const ev = await Event.findById(id).populate('attendingPairs', 'club')
      if (!ev) return res.status(404).json({ message: 'Event not found' })

      const user = await User.findById(userId).select('role').lean()
      const role = String(user?.role || '').toLowerCase()
      const isCreator = String(ev.user) === String(userId)
      let isClubUploader = false
      if (Array.isArray(ev.attendingPairs) && ev.attendingPairs.length) {
        isClubUploader = ev.attendingPairs.some((p: any) => String((p as any).club) === String(userId))
      }

      const idx = (ev.results || []).findIndex((r: any) => String((r as any)._id || r.id) === String(resultId))
      if (idx === -1) return res.status(404).json({ message: 'Result not found' })

      const resultEntry = ev.results[idx]
      const resultCreator = String(resultEntry.createdBy || '')

      // allow deletion if: result creator, event creator, admin/arbitru, or club that owns the pair (if pairId present)
      const isAdmin = role.includes('admin') || role.includes('arbitru')
      let allowed = false
      if (String(userId) === String(resultCreator)) allowed = true
      if (isCreator) allowed = true
      if (isAdmin) allowed = true
      if (!allowed && resultEntry.pairId) {
        // check pair ownership
        try {
          const pid = String(resultEntry.pairId)
          const matching = Array.isArray(ev.attendingPairs) ? ev.attendingPairs.find((p: any) => String(p._id || p) === pid) : null
          if (matching && String((matching as any).club) === String(userId)) allowed = true
        } catch (e) {}
      }

      if (!allowed) return res.status(403).json({ message: 'Forbidden' })

      ev.results.splice(idx, 1)
      await ev.save()
      return res.status(200).json({ ok: true })
    } catch (err) {
      console.error('[api/events/[id]/results] DELETE error', err)
      return res.status(500).json({ message: 'Server error' })
    }
  }

  res.setHeader('Allow', ['POST'])
  return res.status(405).end(`Method ${req.method} Not Allowed`)
}
