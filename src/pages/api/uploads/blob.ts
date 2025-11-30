import type { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../auth/[...nextauth]'
import dbConnect from '../../../lib/mongoose'
import mongoose from 'mongoose'
import Event from '../../../models/Event'
import { put } from '@vercel/blob'

export const config = {
  api: { bodyParser: false },
}

async function getRawBody(req: NextApiRequest) {
  return await new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (chunk: Buffer) => chunks.push(chunk))
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', (err) => reject(err))
  })
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const session = await getServerSession(req, res, authOptions as any)
  if (!session) return res.status(401).json({ error: 'Unauthorized' })
  const userId = (session as any)?.user?.id
  if (!userId) return res.status(401).json({ error: 'Unauthorized' })

  const eventId = String(req.query.eventId || req.query.event || '')
  const pairId = String(req.query.pairId || '')
  const filename = String((req.query.filename as string) || req.headers['x-filename'] || '')
  const contentType = String(req.headers['content-type'] || 'application/octet-stream')
  if (!eventId) return res.status(400).json({ error: 'eventId query param required' })
  if (!filename) return res.status(400).json({ error: 'filename query param required or X-Filename header' })

  await dbConnect()

  try {
    const ev = await Event.findById(eventId).populate('attendingPairs', 'club')
    if (!ev) return res.status(404).json({ error: 'Event not found' })

    // ensure uploader is either event creator or belongs to a club that has an attending pair
    const isCreator = String(ev.user) === String(userId)
    let isClubUploader = false
    if (Array.isArray(ev.attendingPairs) && ev.attendingPairs.length) {
      // ev.attendingPairs populated with pair docs that include `club`
      isClubUploader = ev.attendingPairs.some((p: any) => String(p.club) === String(userId))
    }
    if (!isCreator && !isClubUploader) return res.status(403).json({ error: 'Forbidden' })

    // if a pairId is provided, ensure that pair is attending and that the uploader is the owning club (or event creator)
    let pairBelongsToUploader = false
    if (pairId) {
      const matching = Array.isArray(ev.attendingPairs) ? ev.attendingPairs.find((p: any) => String(p._id || p) === String(pairId)) : null
      if (!matching) return res.status(400).json({ error: 'Pair not attending this event' })
      // matching may be populated pair doc (with club) or an id; if it's populated check club
      if (matching && (matching as any).club) {
        pairBelongsToUploader = String((matching as any).club) === String(userId)
      }
      // allow event creator as well
      if (!pairBelongsToUploader && isCreator) pairBelongsToUploader = true
      if (!pairBelongsToUploader) return res.status(403).json({ error: 'Forbidden for this pair' })
    }

    // additionally, if the uploader is a club (owns any attending pair) but is NOT the event creator,
    // require that a pairId is provided so uploads are associated with a specific pair. This prevents clubs
    // from uploading generic event-level photos and enforces per-pair scoping.
    if (!pairId && isClubUploader && !isCreator) {
      return res.status(400).json({ error: 'Club uploads must specify a pairId' })
    }

    // enforce limits:
    // - If pairId provided: enforce per-pair limit (max 4 photos per pair for the event)
    // - If no pairId provided: enforce per-user-per-event limit (max 4 photos per uploader for event)
    if (pairId) {
      const existingForPair = Array.isArray(ev.photos) ? ev.photos.filter((p: any) => String(p.pairId || '') === String(pairId)).length : 0
      if (existingForPair >= 4) {
        return res.status(400).json({ error: 'Photo limit for this pair reached (4)' })
      }
    } else {
      const existingPhotosByUser = Array.isArray(ev.photos) ? ev.photos.filter((p: any) => String(p.uploadedBy || '') === String(userId)).length : 0
      if (existingPhotosByUser >= 4) {
        return res.status(400).json({ error: 'Photo limit per user reached (4)' })
      }
    }

    const buffer = await getRawBody(req)

    // upload with @vercel/blob SDK
    const token = process.env.BLOB_READ_WRITE_TOKEN
    const teamId = process.env.BLOB_TEAM_ID || process.env.VERCEL_TEAM_ID
    const opts: any = { access: 'public' }
    if (token) opts.token = token
    if (teamId) opts.team = teamId

  const result = await put(filename, buffer, opts) as any

  // result typically contains id and url
  const blobId = (result && (result.id || result.blobId || result.key)) || null
  const url = result && (result.url || result.publicURL || result.uploadURL || result.public_url) || null

    const photo: any = {
      blobId: blobId,
      url: url,
      filename,
      contentType,
      size: buffer.length,
      uploadedAt: new Date(),
      uploadedBy: userId,
    }
    if (pairId) {
      try {
        photo.pairId = new mongoose.Types.ObjectId(pairId)
      } catch (e) {
        // fallback to raw string if invalid
        photo.pairId = pairId
      }
    }

    // Save photo only; results are handled by a separate API endpoint
    ev.photos = ev.photos || []
    ev.photos.push(photo)
    await ev.save()

    return res.status(200).json({ ok: true, photo })
  } catch (err: any) {
    console.error('upload blob error', err)
    // try to surface vercel error details
    return res.status(500).json({ error: 'Upload failed', details: String(err && err.message ? err.message : err) })
  }
}
