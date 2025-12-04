import type { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../../auth/[...nextauth]'
import dbConnect from '../../../../lib/mongoose'
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

  // DELETE /api/events/:id/photos?blobId=...  or ?url=... or ?photoId=...
  if (req.method === 'DELETE') {
    try {
      const { blobId, url, photoId } = req.query
      console.log('[api/events/[id]/photos] DELETE called', { id, blobId, url, photoId, userId })
      if (!blobId && !url && !photoId) return res.status(400).json({ message: 'blobId or url or photoId required' })

      const ev = await Event.findById(id)
      if (!ev) return res.status(404).json({ message: 'Event not found' })

      // find photo index (support blobId, url or the photo document _id via photoId)
      const idx = ev.photos ? ev.photos.findIndex((p: any) => {
        if (photoId && String((p._id || p.id) || '') === String(photoId)) return true
        if (blobId && String(p.blobId || '') === String(blobId)) return true
        if (url && String(p.url || '') === String(url)) return true
        return false
      }) : -1
      console.log('[api/events/[id]/photos] found photo index', { idx })
      if (idx === -1) return res.status(404).json({ message: 'Photo not found on event' })

      const photo = ev.photos[idx]
  console.log('[api/events/[id]/photos] photo matched', { photoId: String((photo as any)._id || (photo as any).id || ''), blobId: photo.blobId, url: photo.url })

  // permission: uploader, event creator, admin/arbitru, or event judge
  const user = await User.findById(userId).select('role').lean()
  const role = String(user?.role || '').toLowerCase()
  const isUploader = photo.uploadedBy && String(photo.uploadedBy) === String(userId)
  const isCreator = String(ev.user) === String(userId)
  const isAdmin = role.includes('admin') || role.includes('arbitru')
  const isJudge = Array.isArray(ev.judges) && ev.judges.some((j: any) => String(j) === String(userId))
  console.log('[api/events/[id]/photos] permission check', { isUploader, isCreator, isAdmin, isJudge, role })
  if (!isUploader && !isCreator && !isAdmin && !isJudge) return res.status(403).json({ message: 'Forbidden' })

      // attempt to delete from Vercel Blob if blobId is present
      let removedFromStorage = false
      if (photo.blobId) {
        const token = process.env.BLOB_READ_WRITE_TOKEN
        const team = process.env.BLOB_TEAM_ID || process.env.VERCEL_TEAM_ID
        if (!token) {
          // token not configured: log and continue to remove metadata to avoid leaving UI in inconsistent state.
          console.warn('BLOB_READ_WRITE_TOKEN not configured; skipping storage deletion for blobId=', photo.blobId)
        }

        try {
          if (token) {
            const delUrl = `https://api.vercel.com/v1/blob/${encodeURIComponent(photo.blobId)}${team ? `?teamId=${encodeURIComponent(team)}` : ''}`
            console.log('[api/events/[id]/photos] attempting storage delete', { delUrl })
            const delResp = await fetch(delUrl, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
            const delText = await delResp.text().catch(() => '')
            console.log('[api/events/[id]/photos] storage delete response', { status: delResp.status, body: delText })
            if (delResp.ok || delResp.status === 404) {
              removedFromStorage = true
            } else {
              console.error('vercel delete failed', delResp.status, delText)
              // don't block metadata removal for transient storage failures; warn and continue
            }
          }
        } catch (err: any) {
          console.error('vercel delete threw', err)
          // warn and continue to remove metadata
        }
      }

  // remove from event.photos
      ev.photos.splice(idx, 1)
      await ev.save()
  console.log('[api/events/[id]/photos] removed photo from event and saved', { eventId: ev._id, removedFromStorage })

      return res.status(200).json({ ok: true, removedFromStorage })
    } catch (err: any) {
      console.error('[api/events/[id]/photos] DELETE error', err)
      return res.status(500).json({ message: 'Server error', details: String(err) })
    }
  }

  return res.status(405).end()
}
