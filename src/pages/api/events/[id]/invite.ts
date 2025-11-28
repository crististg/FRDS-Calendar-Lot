import type { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../../auth/[...nextauth]'
import dbConnect from '../../../../lib/mongoose'
import Event from '../../../../models/Event'
import User from '../../../../models/User'

type ReqBody = {
  emails?: string[]
  userIds?: string[]
  pairIds?: string[]
  clubIds?: string[]
  inviteJudges?: boolean
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const session = await getServerSession(req, res, authOptions as any)
  if (!session) return res.status(401).json({ error: 'Unauthorized' })
  const userId = (session as any)?.user?.id
  if (!userId) return res.status(401).json({ error: 'Unauthorized' })

  const { emails, userIds, pairIds, clubIds, inviteJudges } = req.body as ReqBody
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

  // If pairIds are provided, resolve their clubs and prepare pair labels grouped by club
  let pairGroups: Record<string, Array<{ id: string; label: string }>> = {}
  if (Array.isArray(pairIds) && pairIds.length > 0) {
    const Pair = (await import('../../../../models/Pair')).default
    const pairs = await Pair.find({ _id: { $in: pairIds } }).lean()
    for (const p of pairs) {
      const clubId = String(p.club || '')
      const name1 = (p.partner1 && p.partner1.fullName) || ''
      const name2 = (p.partner2 && p.partner2.fullName) || ''
      const label = `${name1}${name2 ? ` / ${name2}` : ''}`
      pairGroups[clubId] = pairGroups[clubId] || []
      pairGroups[clubId].push({ id: String(p._id), label })
    }
  }



  // If clubIds provided, fetch those clubs (users with role 'club')
  let clubs: any[] = []
  if (Array.isArray(clubIds) && clubIds.length > 0) {
    clubs = await User.find({ _id: { $in: clubIds } }).select('email clubName contactPerson fullName').lean()
    const clubEmails = clubs.map((c) => String(c.email || '').trim()).filter(Boolean)
    recipients = recipients.concat(clubEmails)
  }

  // Also include contact emails for any clubs referenced by selected pairIds
  const pairClubIds = Object.keys(pairGroups).filter(Boolean)
  if (pairClubIds.length > 0) {
    try {
      const pairClubUsers = await User.find({ _id: { $in: pairClubIds } }).select('email clubName contactPerson fullName').lean()
      for (const cu of pairClubUsers) {
        const exists = clubs.some((c: any) => String(c._id || c) === String(cu._id))
        if (!exists) clubs.push(cu)
        if (cu.email) recipients.push(String(cu.email).trim())
      }
    } catch (err) {
      console.error('[api/events/[id]/invite] failed to fetch pair clubs', err)
    }
  }

  // If inviteJudges flag is set, include all users with judge/admin roles
  if (inviteJudges) {
    const judges = await User.find({ role: { $regex: /(arbitru|judge|admin)/i } }).select('email').lean()
    const je = judges.map((j) => String(j.email || '').trim()).filter(Boolean)
    recipients = recipients.concat(je)
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

    // Permission logic:
    // - creators always allowed
    // - judges/admins who are attending are allowed
    // - club users are allowed to invite their own pairs / their own club
    const isCreator = String(ev.user) === String(userId)
    const isJudge = role.includes('arbitru') || role.includes('judge') || role.includes('admin')
    const isAttendee = Array.isArray((ev as any).attendees) && (ev as any).attendees.map(String).includes(String(userId))
    const isJudgeAttending = Array.isArray((ev as any).judges) && (ev as any).judges.map(String).includes(String(userId))

    let allowed = false
    if (isCreator) allowed = true
    if (isJudge && (isAttendee || isJudgeAttending)) allowed = true
    // allow club users to invite their own pairs or their own club
    if (!allowed && String(user?.role || '').toLowerCase() === 'club') {
      const uid = String(userId)
      // if pairIds provided, ensure all pairs belong to this club
      if (pairIds && pairIds.length > 0) {
        const Pair = (await import('../../../../models/Pair')).default
        const owned = await Pair.find({ _id: { $in: pairIds }, club: uid }).countDocuments()
        if (owned === pairIds.length) allowed = true
      }
      // if clubIds provided, ensure it contains only this club
      if (!allowed && clubIds && clubIds.length > 0) {
        const allMine = clubIds.every((cid) => String(cid) === uid)
        if (allMine) allowed = true
      }
    }

    if (!allowed) return res.status(403).json({ error: 'Forbidden: must be creator, attending judge, or club inviting own pairs/club' })

    const apiKey = process.env.RESEND_API_KEY
    const from = process.env.MAIL_FROM || `no-reply@${(process.env.VERCEL_URL || 'localhost').replace(/^https?:\/\//, '')}`
    const appUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || `http://localhost:3000`
    const eventLink = `${appUrl.replace(/\/$/, '')}/app?event=${id}`

    if (!apiKey) return res.status(500).json({ error: 'RESEND_API_KEY not configured' })

    // helper to escape simple HTML
    const escapeHtml = (s: any) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\"/g, '&quot;')

  const logoUrl = `${appUrl.replace(/\/$/, '')}/static/example-logo.png`

    // Prepare a structured message body describing what was invited (pairs/clubs/judges)
    const invitedSummary: string[] = []
    // pairs grouped by club -> present readable list
    for (const [clubId, items] of Object.entries(pairGroups)) {
      const clubUser = await User.findById(clubId).select('clubName fullName email contactPerson').lean()
      const clubLabel = (clubUser && (clubUser.clubName || clubUser.fullName)) || `Club ${clubId}`
      invitedSummary.push(`Perechi din ${clubLabel}: ${items.map((it) => it.label).join(', ')}`)
    }
    if (clubs && clubs.length > 0) {
      invitedSummary.push(`Cluburi invitate: ${clubs.map((c) => c.clubName || c.fullName || c.email).join(', ')}`)
    }
    if (inviteJudges) invitedSummary.push('Arbitri/formatori invitați')

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

      // Build a nicer HTML body with invitedSummary and event details
      // Build a richer HTML summary with grouped pairs per club and invited clubs list
      const buildPairsHtml = () => {
        if (!pairGroups || Object.keys(pairGroups).length === 0) return ''
        let out = '<div style="margin-bottom:12px;">'
        out += '<h3 style="margin:0 0 8px;font-size:15px;color:#0f172a;">Perechi invitate</h3>'
        for (const [clubId, items] of Object.entries(pairGroups)) {
          const clubUser = clubs.find((c: any) => String(c._id) === String(clubId))
          const clubLabel = (clubUser && (clubUser.clubName || clubUser.fullName)) || `Club ${escapeHtml(clubId)}`
          out += `<div style="margin:8px 0;padding:10px;border-radius:6px;background:#f8fafc;border:1px solid #eef2f7;"><strong style=\"display:block;margin-bottom:6px;color:#0f172a;\">${escapeHtml(clubLabel)}</strong>`
          out += '<ul style="margin:0;padding-left:18px;color:#334155">'
          for (const it of items) {
            out += `<li style=\"margin:3px 0;line-height:1.35;\">${escapeHtml(it.label)}</li>`
          }
          out += '</ul></div>'
        }
        out += '</div>'
        return out
      }

      const buildClubsHtml = () => {
        if (!clubs || clubs.length === 0) return ''
        const list = clubs.map((c: any) => `<li style="margin:4px 0;">${escapeHtml(c.clubName || c.fullName || c.email || String(c._id))}</li>`).join('')
        return `<div style="margin-bottom:12px;"><h3 style="margin:0 0 8px;font-size:15px;color:#0f172a;">Cluburi invitate</h3><ul style="margin:0;padding-left:18px;color:#334155">${list}</ul></div>`
      }

      const pairsHtml = buildPairsHtml()
      const clubsHtml = buildClubsHtml()

      const judgesHtml = inviteJudges ? '<p style="margin:0 0 12px;color:#334155;">Au fost invitați arbitrii și formatorii înregistrați.</p>' : ''

      const html = `<!doctype html>
        <html>
          <head>
            <meta charset="utf-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1.0" />
            <title>${escapeHtml(ev.title)}</title>
          </head>
          <body style="margin:0;padding:24px;font-family:Inter, system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;background:#f1f5f9;">
            <div style="max-width:680px;margin:0 auto;background:#ffffff;border-radius:10px;overflow:hidden;box-shadow:0 6px 18px rgba(15,23,42,0.08);">
              <div style="padding:22px;text-align:center;border-bottom:1px solid #eef2f7;">
                <img src="https://www.dancesport.ro/beta/wp-content/uploads/2015/10/favicon.png" width="72" height="72" alt="Logo" style="display:block;margin:0 auto;border-radius:8px;" />
              </div>
              <div style="padding:22px;color:#0f172a;">
                <h1 style="font-size:20px;margin:0 0 12px;font-weight:700;text-align:center;">Invitație: ${escapeHtml(ev.title)}</h1>
                <p style="margin:0 0 12px;color:#334155;">Salut ${escapeHtml(displayName)},</p>
                ${pairsHtml}
                ${clubsHtml}
                ${judgesHtml}
                ${ev.description ? `<p style="margin:0 0 12px;color:#334155;">${escapeHtml(ev.description)}</p>` : ''}

                <!-- event details with CTA: use table layout for best email client compatibility -->
                <table role="presentation" width="100%" style="margin:16px 0;border-collapse:separate;border-spacing:0;background:#ffffff;border:1px solid #e6eef8;border-radius:8px;overflow:hidden;">
                  <tr>
                    <td style="padding:12px 14px;vertical-align:middle;font-size:14px;color:#0f172a;">
                      <div style="margin-bottom:6px;"><strong>Locație:</strong> ${escapeHtml(([ev.address, ev.city, ev.country].filter(Boolean).join(', ')) || '-')}</div>
                      <div><strong>Data:</strong> ${ev.start ? escapeHtml(new Date(ev.start).toLocaleString('ro-RO')) : '-'}</div>
                    </td>
                    <td style="padding:12px 14px;vertical-align:middle;text-align:center;width:220px;min-width:160px;">
                      <a href="${escapeHtml(eventLink)}" style="display:inline-block;background:#0066cc;color:#fff;padding:11px 18px;border-radius:8px;text-decoration:none;font-weight:600;">Vizualizează evenimentul</a>
                    </td>
                  </tr>
                </table>

                <p style="margin:0;color:#94a3b8;font-size:13px;">Dacă nu ați solicitat această invitație, ignorați acest mesaj.</p>
                <p style="margin:12px 0 0;color:#334155;">Cu respect,<br/>Echipa FRDS</p>
              </div>
              <div style="padding:12px 16px;background:#f8fafc;color:#94a3b8;font-size:12px;text-align:center;border-top:1px solid #eef2f7;">© ${new Date().getFullYear()} FRDS — Toate drepturile rezervate</div>
            </div>
          </body>
        </html>`

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
