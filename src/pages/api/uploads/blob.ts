import type { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../auth/[...nextauth]'
import dbConnect from '../../../lib/mongoose'
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
  const filename = String((req.query.filename as string) || req.headers['x-filename'] || '')
  const contentType = String(req.headers['content-type'] || 'application/octet-stream')
  if (!eventId) return res.status(400).json({ error: 'eventId query param required' })
  if (!filename) return res.status(400).json({ error: 'filename query param required or X-Filename header' })

  await dbConnect()

  try {
    const ev = await Event.findById(eventId)
    if (!ev) return res.status(404).json({ error: 'Event not found' })

    // ensure user is attendee or creator
    const isAttendee = (ev.attendees || []).map((a: any) => String(a)).includes(String(userId))
    const isCreator = String(ev.user) === String(userId)
    if (!isAttendee && !isCreator) return res.status(403).json({ error: 'Forbidden' })

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

    const photo = {
      blobId: blobId,
      url: url,
      filename,
      contentType,
      size: buffer.length,
      uploadedAt: new Date(),
      uploadedBy: userId,
    }

    ev.photos = (ev.photos || []).concat([photo])
    await ev.save()

    return res.status(200).json({ ok: true, photo })
  } catch (err: any) {
    console.error('upload blob error', err)
    // try to surface vercel error details
    return res.status(500).json({ error: 'Upload failed', details: String(err && err.message ? err.message : err) })
  }
}
