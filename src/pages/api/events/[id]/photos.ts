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

  // DELETE /api/events/:id/photos?blobId=...  or ?url=...
  if (req.method === 'DELETE') {
    try {
      const { blobId, url } = req.query
      if (!blobId && !url) return res.status(400).json({ message: 'blobId or url required' })

      const ev = await Event.findById(id)
      if (!ev) return res.status(404).json({ message: 'Event not found' })

      // find photo index
      const idx = ev.photos ? ev.photos.findIndex((p: any) => (blobId && String(p.blobId) === String(blobId)) || (url && String(p.url) === String(url))) : -1
      if (idx === -1) return res.status(404).json({ message: 'Photo not found on event' })

      const photo = ev.photos[idx]

      // permission: uploader, event creator, or admin/arbitru
      const user = await User.findById(userId).select('role').lean()
      const role = String(user?.role || '').toLowerCase()
      const isUploader = photo.uploadedBy && String(photo.uploadedBy) === String(userId)
      const isCreator = String(ev.user) === String(userId)
      const isAdmin = role.includes('admin') || role.includes('arbitru')
      if (!isUploader && !isCreator && !isAdmin) return res.status(403).json({ message: 'Forbidden' })

      // attempt to delete from Vercel Blob if blobId is present
      let removedFromStorage = false
      if (photo.blobId) {
        const token = process.env.BLOB_READ_WRITE_TOKEN
        const team = process.env.BLOB_TEAM_ID || process.env.VERCEL_TEAM_ID
        if (!token) {
          console.error('BLOB_READ_WRITE_TOKEN not configured')
          return res.status(500).json({ message: 'BLOB_READ_WRITE_TOKEN not configured' })
        }

        try {
          const delUrl = `https://api.vercel.com/v1/blob/${encodeURIComponent(photo.blobId)}${team ? `?teamId=${encodeURIComponent(team)}` : ''}`
          const delResp = await fetch(delUrl, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
          const delText = await delResp.text().catch(() => '')
          if (delResp.ok || delResp.status === 404) {
            removedFromStorage = true
          } else {
            console.error('vercel delete failed', delResp.status, delText)
            // do not remove metadata if storage deletion failed
            return res.status(502).json({ message: 'Failed deleting blob from storage', status: delResp.status, body: delText })
          }
        } catch (err: any) {
          console.error('vercel delete threw', err)
          return res.status(502).json({ message: 'Failed deleting blob from storage', details: String(err) })
        }
      }

      // remove from event.photos
      ev.photos.splice(idx, 1)
      await ev.save()

      return res.status(200).json({ ok: true, removedFromStorage })
    } catch (err: any) {
      console.error('[api/events/[id]/photos] DELETE error', err)
      return res.status(500).json({ message: 'Server error', details: String(err) })
    }
  }

  return res.status(405).end()
}
