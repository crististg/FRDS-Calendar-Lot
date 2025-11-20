import type { NextApiRequest, NextApiResponse } from 'next'
import dbConnect from '../../../lib/mongoose'
import User from '../../../models/User'
import { hashPassword } from '../../../lib/auth'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  let { token, password } = req.body || {}
  // normalize token (could be string or array)
  if (Array.isArray(token)) token = token[0]
  token = token ? String(token).trim() : ''
  if (!token || !password) return res.status(400).json({ error: 'Token and password required' })
  if (String(password).length < 7) return res.status(422).json({ error: 'Password too short' })

  try {
    await dbConnect()
    // try exact match first
    let user = await User.findOne({ resetPasswordToken: token, resetPasswordExpires: { $gt: new Date() } })
    if (!user) {
      // try decoding in case the token was URL-encoded/decoded inconsistently
      try {
        const decoded = decodeURIComponent(token)
        if (decoded !== token) {
          user = await User.findOne({ resetPasswordToken: decoded, resetPasswordExpires: { $gt: new Date() } })
        }
      } catch (e) {
        // ignore
      }
    }
    if (!user) return res.status(400).json({ error: 'Invalid or expired token' })

    user.password = await hashPassword(String(password))
    user.resetPasswordToken = undefined as any
    user.resetPasswordExpires = undefined as any
    await user.save()

    return res.status(200).json({ ok: true })
  } catch (err) {
    console.error('reset password error', err)
    return res.status(500).json({ error: 'Server error' })
  }
}
