import type { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../../auth/[...nextauth]'
import dbConnect from '../../../../lib/mongoose'
import Event from '../../../../models/Event'
import User from '../../../../models/User'

type ReqBody = {
  emails?: string[]
  userIds?: string[]
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const session = await getServerSession(req, res, authOptions as any)
  if (!session) return res.status(401).json({ error: 'Unauthorized' })
  const userId = (session as any)?.user?.id
  if (!userId) return res.status(401).json({ error: 'Unauthorized' })

  const { emails, userIds } = req.body as ReqBody
  // ensure DB is connected before looking up users
  await dbConnect()

  // Build recipient emails list. Prefer server-side user lookup when userIds are provided.
  let recipients: string[] = []
  if (Array.isArray(emails)) {
    recipients = recipients.concat(emails.map((e) => String(e).trim()).filter(Boolean))
  }
  let users: any[] = []
  if (Array.isArray(userIds) && userIds.length > 0) {
    // load users and extract emails
    users = await User.find({ _id: { $in: userIds } }).select('email').lean()
    const fromIds = users.map((u) => String(u.email || '').trim()).filter(Boolean)
    recipients = recipients.concat(fromIds)
  }

  // dedupe and validate
  recipients = Array.from(new Set(recipients.map((r) => String(r).toLowerCase()))).filter(Boolean)
  if (recipients.length === 0) {
    const missing = Array.isArray(userIds) && userIds.length > 0 ? userIds.filter((id) => !users.find((u) => String(u._id) === String(id) && u.email)) : []
    return res.status(422).json({ error: 'No recipient emails provided', missingUserIds: missing })
  }

  const { id } = req.query
  if (!id || Array.isArray(id)) return res.status(400).json({ error: 'Invalid event id' })

  await dbConnect()

  try {
    const ev = await Event.findById(id).lean()
    if (!ev) return res.status(404).json({ error: 'Event not found' })

    const user = await User.findById(userId).select('role').lean()
    const role = String(user?.role || '').toLowerCase()

    // Only allow if requester is creator or has judge/admin role AND is an attendee
    const isCreator = String(ev.user) === String(userId)
    const isJudge = role.includes('arbitru') || role.includes('judge') || role.includes('admin')

    // ensure user is attendee
    const isAttendee = Array.isArray(ev.attendees) && ev.attendees.map(String).includes(String(userId))

    if (!(isCreator || (isJudge && isAttendee))) {
      return res.status(403).json({ error: 'Forbidden: must be creator or judge attending the event' })
    }

    const apiKey = process.env.RESEND_API_KEY
    const from = process.env.MAIL_FROM || `no-reply@${(process.env.VERCEL_URL || 'localhost').replace(/^https?:\/\//, '')}`
    const appUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || `http://localhost:3000`
    const eventLink = `${appUrl.replace(/\/$/, '')}/app?event=${id}`

    if (!apiKey) return res.status(500).json({ error: 'RESEND_API_KEY not configured' })

    // Build HTML content
    const html = `<p>Ai primit o invitație la eveniment <strong>${ev.title}</strong>.</p>
      <p>Detalii: ${ev.description || ''}</p>
      <p>Locație: ${ev.location || '-'}</p>
      <p>Data: ${new Date(ev.start).toLocaleString('ro-RO')}</p>
      <p><a href="${eventLink}">Deschide evenimentul și acceptă invitația</a></p>`

    // Call Resend API
    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: recipients,
        subject: `Invitație: ${ev.title}`,
        html,
      }),
    })

    if (!resp.ok) {
      const text = await resp.text().catch(() => '')
      console.error('[resend] send failed', resp.status, text)
      // surface resend response for easier debugging
      return res.status(502).json({ error: 'Failed to send email', status: resp.status, body: text })
    }

    const data = await resp.json().catch(() => ({}))
    return res.status(200).json({ ok: true, result: data })
  } catch (err) {
    console.error('[api/events/[id]/invite] error', err)
    return res.status(500).json({ error: 'Server error' })
  }
}
