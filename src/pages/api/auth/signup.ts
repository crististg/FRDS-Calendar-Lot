import type { NextApiRequest, NextApiResponse } from 'next'
import dbConnect from '../../../lib/mongoose'
import User from '../../../models/User'
import { hashPassword } from '../../../lib/auth'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()

  const { email, password, fullName, firstName: bodyFirstName, lastName: bodyLastName, birthday, role, cardNumber, clubName, clubCity, contactPerson, phone } = req.body || {}

  // Basic validation (keep in sync with the client-side checks)
  if (!email || !password || password.length < 7) {
    return res.status(422).json({ message: 'Invalid input: missing email or password or password too short', details: { email: !!email, password: !!password, passwordLength: password ? password.length : 0 } })
  }
  // Validate profile fields for non-club roles. Club registrations have different required fields
  const missing: string[] = []
  if (role !== 'club') {
    // accept either explicit first/last names or a fullName string
    const hasName = !!(bodyFirstName || bodyLastName || fullName)
    if (!hasName) missing.push('name')
    if (!birthday) missing.push('birthday')
    if (missing.length) {
      return res.status(422).json({ message: 'Missing required profile fields', missing })
    }
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

    // Role handling — default to 'club' (clubs will add dancers later)
    const finalRole = role || 'club'
    const finalCard = (cardNumber || '').toString().trim() || undefined

    // If registering a club, require clubName and contactPerson and phone
    const finalClubName = (clubName || '').toString().trim() || undefined
    const finalClubCity = (clubCity || '').toString().trim() || undefined
    const finalContact = (contactPerson || '').toString().trim() || undefined
    const finalPhone = (phone || '').toString().trim() || undefined
    if (finalRole === 'club') {
      if (!finalClubName || !finalContact || !finalPhone) {
        return res.status(422).json({ message: 'Missing required club fields (clubName, contactPerson, phone)' })
      }
    }

    const hashed = await hashPassword(password)
    const userObj: any = {
      email,
      password: hashed,
      fullName: rawFull,
      firstName,
      lastName,
      birthday: birthDate,
      role: finalRole,
      cardNumber: finalCard,
    }
    if (finalRole === 'club') {
      userObj.clubName = finalClubName
      if (finalClubCity) userObj.clubCity = finalClubCity
      userObj.contactPerson = finalContact
      userObj.phone = finalPhone
    }
    const user = new User(userObj)
    await user.save()

    return res.status(201).json({ ok: true, id: String(user._id) })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ message: 'Server error' })
  }
}
