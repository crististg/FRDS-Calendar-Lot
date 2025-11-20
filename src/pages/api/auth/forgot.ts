import type { NextApiRequest, NextApiResponse } from 'next'
import crypto from 'crypto'
import dbConnect from '../../../lib/mongoose'
import User from '../../../models/User'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { email } = req.body || {}
  if (!email) return res.status(400).json({ error: 'Email required' })

  try {
    await dbConnect()
    const user = await User.findOne({ email: String(email).toLowerCase().trim() })
    if (!user) {
      // respond 200 to avoid leaking which emails exist
      return res.status(200).json({ ok: true })
    }

    // generate token
    const token = crypto.randomBytes(32).toString('hex')
    const expires = new Date(Date.now() + 1000 * 60 * 60) // 1 hour
    user.resetPasswordToken = token
    user.resetPasswordExpires = expires
    await user.save()

    // send email via Resend
    const apiKey = process.env.RESEND_API_KEY
    const from = process.env.MAIL_FROM || `no-reply@${(process.env.VERCEL_URL || 'localhost').replace(/^https?:\/\//, '')}`
    const appUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || `http://localhost:3000`
    const resetLink = `${appUrl.replace(/\/$/, '')}/reset-password?token=${encodeURIComponent(token)}`

    if (!apiKey) return res.status(500).json({ error: 'RESEND_API_KEY not configured' })

    const html = `
      <div style="font-family:system-ui, -apple-system, Roboto, Arial; font-size:16px; color:#111;">
        <h2>Resetare parolă</h2>
        <p>Salut,</p>
        <p>Am primit o solicitare pentru resetarea parolei contului asociat acestui email. Dacă ai cerut aceasta, apasă butonul de mai jos pentru a reseta parola (link-ul expiră în 1 oră).</p>
        <p style="text-align:center;margin:20px 0;"><a href="${resetLink}" style="background:#00A3FF;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none;">Resetează parola</a></p>
        <p>Dacă nu ai cerut acest lucru, poți ignora acest email.</p>
      </div>
    `

    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: [user.email], subject: 'Resetare parolă', html })
    })
    if (!resp.ok) {
      const text = await resp.text().catch(() => '')
      console.error('Resend send failed', resp.status, text)
      return res.status(502).json({ error: 'Failed to send email' })
    }

    return res.status(200).json({ ok: true })
  } catch (err) {
    console.error('forgot password error', err)
    return res.status(500).json({ error: 'Server error' })
  }
}
