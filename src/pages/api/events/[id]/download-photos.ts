import type { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../../auth/[...nextauth]'
import dbConnect from '../../../../lib/mongoose'
import Event from '../../../../models/Event'
import User from '../../../../models/User'
// archiver types may not be installed in the workspace; import with a ts-ignore to avoid type errors until dependency is installed
// @ts-ignore
import archiver from 'archiver'

export const config = {
  api: {
    bodyParser: false,
  },
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions as any)
  if (!session) return res.status(401).json({ message: 'Unauthorized' })
  const userId = (session as any)?.user?.id
  if (!userId) return res.status(401).json({ message: 'Unauthorized' })

  const { id } = req.query
  if (!id || Array.isArray(id)) return res.status(400).json({ message: 'Invalid id' })

  await dbConnect()

  if (req.method !== 'GET') return res.status(405).end()

  try {
    const ev = await Event.findById(id).lean()
    if (!ev) return res.status(404).json({ message: 'Event not found' })

    const user = await User.findById(userId).select('role').lean()
    const role = String(user?.role || '').toLowerCase()
    const isAdmin = role.includes('admin') || role.includes('arbitru')
    const isCreator = String(ev.user) === String(userId)
    if (!isAdmin && !isCreator) return res.status(403).json({ message: 'Forbidden' })

    // determine which photos to include
    const { userId: qUserId, all } = req.query as { userId?: string; all?: string }
    let photos: any[] = Array.isArray(ev.photos) ? (ev.photos as any[]) : []
    if (!all && qUserId) {
      photos = photos.filter((p) => String(p.uploadedBy) === String(qUserId))
    }

    if (!photos.length) return res.status(404).json({ message: 'No photos found for selection' })

    // stream a zip
    res.setHeader('Content-Type', 'application/zip')
    // determine filename and prepare uploader name map
    const qUserIdStr = (req.query as any).userId as string | undefined
    const isAll = !!(req.query as any).all
    const sanitizeName = (s: any) => String(s || '').replace(/[\\/:*?"<>|\n\r]+/g, ' ').trim()
    const safeEventTitle = sanitizeName(ev.title || 'event')

    // build a map of uploader id -> name using attendees and DB lookup as fallback
    const uploaderIds = Array.from(new Set((photos || []).map((p: any) => String(p.uploadedBy || '')).filter(Boolean)))
    const usersMap: Record<string, string> = {}
    // try to use attendees array first
    ;(ev.attendees || []).forEach((at: any) => {
      const key = String((at && (at._id || at.id)) || at)
      if (!key) return
      const name = at && (at.fullName || [at.firstName, at.lastName].filter(Boolean).join(' ') || at.email)
      if (name) usersMap[key] = name
    })
    // fetch remaining user names from DB
    const missing = uploaderIds.filter((id) => !usersMap[id])
    if (missing.length) {
      const dbUsers = await User.find({ _id: { $in: missing } }).select('fullName firstName lastName email').lean()
      dbUsers.forEach((u: any) => {
        const key = String(u._id)
        usersMap[key] = u.fullName || [u.firstName, u.lastName].filter(Boolean).join(' ') || u.email || key
      })
    }

    const idToName = (id: any) => {
      if (!id) return ''
      const key = String(id)
      if (usersMap[key]) return usersMap[key]
      if (String(ev.user) === key) return 'Creator'
      return key
    }

    const filename = qUserIdStr && !isAll
      ? `${sanitizeName(idToName(qUserIdStr))} - ${safeEventTitle}.zip`
      : `${safeEventTitle}-photos.zip`
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)

    const archive = archiver('zip', { zlib: { level: 9 } })
    archive.on('error', (err: any) => {
      console.error('[download-photos] archive error', err)
      try {
        res.status(500).end()
      } catch (e) {}
    })
    archive.pipe(res as any)


    // fetch each photo and append to archive. We'll fetch into buffers for simplicity.
    for (const p of photos) {
      try {
        const url = p.url
        if (!url) continue
        const resp = await fetch(url)
        if (!resp.ok) {
          console.warn('[download-photos] failed fetching', url, resp.status)
          continue
        }
        const ab = await resp.arrayBuffer()
        const buffer = Buffer.from(ab)
        const uploaderNameRaw = idToName(p.uploadedBy)
        const uploaderName = sanitizeName(uploaderNameRaw) || 'unknown'
        const safeFilename = (p.filename || p.blobId || 'file').replace(/[^a-z0-9-_.]/gi, '_')
        let entryName: string
        if (qUserIdStr && !isAll) {
          // per-user download: put files under "<Name> - <Event>/filename"
          const folder = `${sanitizeName(idToName(qUserIdStr))} - ${safeEventTitle}`
          entryName = `${folder}/${safeFilename}`
        } else {
          // full event download: folders per uploader
          entryName = `${uploaderName}/${safeFilename}`
        }
        archive.append(buffer, { name: entryName })
      } catch (err: any) {
        console.error('[download-photos] append error', err)
      }
    }

    await archive.finalize()
    // response will be closed by archiver piping
  } catch (err: any) {
    console.error('[api/events/[id]/download-photos] error', err)
    return res.status(500).json({ message: 'Server error', details: String(err) })
  }
}
