import type { NextApiRequest, NextApiResponse } from 'next'
import dbConnect from '../../../lib/mongoose'
import User from '../../../models/User'
import { hashPassword } from '../../../lib/auth'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()

  const { email, password, fullName, firstName: bodyFirstName, lastName: bodyLastName, birthday, role, cardNumber } = req.body || {}

  // Basic validation (keep in sync with the client-side checks)
  if (!email || !password || password.length < 7) {
    return res.status(422).json({ message: 'Invalid input: missing email or password or password too short', details: { email: !!email, password: !!password, passwordLength: password ? password.length : 0 } })
  }
  const missing: string[] = []
  if (!bodyFirstName) missing.push('firstName')
  if (!bodyLastName) missing.push('lastName')
  if (!birthday) missing.push('birthday')
  if (missing.length) {
    return res.status(422).json({ message: 'Missing required profile fields', missing })
  }

  try {
    // Debug: log incoming body to help track client->server mismatch
    console.debug('[signup] incoming body:', req.body)
    await dbConnect()
    const existing = await User.findOne({ email }).lean()
    if (existing) return res.status(422).json({ message: 'User already exists' })

    // Prefer explicit firstName/lastName from the client; fall back to splitting fullName
    const rawFirst = (bodyFirstName || '').toString().trim()
    const rawLast = (bodyLastName || '').toString().trim()
    let firstName = rawFirst
    let lastName = rawLast
    const rawFull = (fullName || `${rawFirst} ${rawLast}`).toString().trim()
    if (!firstName && rawFull) {
      const parts = rawFull.split(/\s+/)
      firstName = parts.shift() || ''
      lastName = parts.join(' ') || ''
    }

    // Parse birthday if provided (expecting YYYY-MM-DD)
    let birthDate: Date | undefined = undefined
    if (birthday) {
      const parsed = new Date(birthday)
      if (!isNaN(parsed.getTime())) birthDate = parsed
    }

    // Role and cardNumber handling
    const finalRole = role || 'dansator'
    const finalCard = (cardNumber || '').toString().trim() || undefined

    // If role requires cardNumber, validate
    if (finalRole === 'dansator' && !finalCard) {
      return res.status(422).json({ message: 'Card number required for dansator role' })
    }

    const hashed = await hashPassword(password)
    const user = new User({
      email,
      password: hashed,
      fullName: rawFull,
      firstName,
      lastName,
      birthday: birthDate,
      role: finalRole,
      cardNumber: finalCard,
    })
    await user.save()

    return res.status(201).json({ ok: true, id: String(user._id) })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ message: 'Server error' })
  }
}
