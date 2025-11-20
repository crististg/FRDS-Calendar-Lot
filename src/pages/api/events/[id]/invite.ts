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

    // helper to escape simple HTML
    const escapeHtml = (s: any) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\"/g, '&quot;')

    const logoUrl = `${appUrl.replace(/\/$/, '')}/static/example-logo.png`

    // send one personalized email per recipient (so we can include the recipient's name when available)
    const sendPromises = recipients.map(async (rcpt) => {
      // try find a user record for personalization
      let recipientName: string | null = null
      const fromUsers = users.find((u: any) => String((u.email || '')).toLowerCase() === String(rcpt).toLowerCase())
      if (fromUsers && (fromUsers.firstName || fromUsers.fullName)) {
        recipientName = (fromUsers.fullName || [fromUsers.firstName, fromUsers.lastName].filter(Boolean).join(' ')).trim()
      } else {
        // attempt a DB lookup for emails provided directly
        try {
          const maybe = await User.findOne({ email: rcpt }).select('firstName lastName fullName').lean()
          if (maybe) recipientName = (maybe.fullName || [maybe.firstName, maybe.lastName].filter(Boolean).join(' ')).trim()
        } catch (err) {
          // ignore lookup errors
        }
      }

      const displayName = recipientName || rcpt.split('@')[0]

      const html = `
        <!doctype html>
        <html>
          <head>
            <meta charset="utf-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1.0" />
            <title>${escapeHtml(ev.title)}</title>
          </head>
          <body style="margin:0;padding:24px;font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
            <div style="max-width:465px;margin:0 auto;background:#ffffff;border-radius:8px;overflow:hidden;">
              <div style="padding:28px 28px 16px;text-align:center;">
                <img src="https://www.dancesport.ro/beta/wp-content/uploads/2015/10/favicon.png" width="80" height="80" alt="Logo" style="display:block;margin:0 auto;" />
              </div>
              <div style="padding:0 28px 28px;color:#0f172a;">
                <h2 style="font-size:20px;margin:8px 0 16px;text-align:center;font-weight:600;">Ai primit o invitație la <strong>${escapeHtml(ev.title)}</strong></h2>
                <p style="margin:0 0 12px;color:#374151;">Salut ${escapeHtml(displayName)},</p>
                <p style="margin:0 0 8px;color:#374151;">${escapeHtml(ev.description || '')}</p>
                <p style="margin:0 0 4px;color:#374151;"><strong>Locație:</strong> ${escapeHtml(ev.location || '-')}</p>
                <p style="margin:0 0 16px;color:#374151;"><strong>Data:</strong> ${ev.start ? escapeHtml(new Date(ev.start).toLocaleString('ro-RO')) : '-'}</p>
                <div style="text-align:center;margin-top:18px;margin-bottom:18px;">
                  <a href="${escapeHtml(eventLink)}" style="background:#00A3FF;color:#fff;padding:12px 20px;border-radius:6px;text-decoration:none;display:inline-block;font-weight:600;">Vizualizează evenimentul</a>
                </div>
                <p style="margin:0;color:#374151;">Cu respect,<br/>Echipa FRDS</p>
              </div>
            </div>
          </body>
        </html>
      `

      const resp = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from,
          to: [rcpt],
          subject: `Invitație: ${ev.title}`,
          html,
          text: `Ai primit o invitație la eveniment ${ev.title}. Deschide: ${eventLink}`,
        }),
      })

      return { email: rcpt, ok: resp.ok, status: resp.status, body: await resp.text().catch(() => '') }
    })

    const results = await Promise.all(sendPromises)
    const failed = results.filter((r) => !r.ok)
    if (failed.length > 0) {
      console.error('[resend] some sends failed', failed)
      return res.status(502).json({ error: 'Some emails failed to send', details: failed })
    }

    return res.status(200).json({ ok: true, results })
  } catch (err) {
    console.error('[api/events/[id]/invite] error', err)
    return res.status(500).json({ error: 'Server error' })
  }
}
