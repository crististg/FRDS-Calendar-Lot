import NextAuth from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { verifyPassword } from '../../../lib/auth'
import dbConnect from '../../../lib/mongoose'
import User from '../../../models/User'

export const authOptions = {
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials: any) {
        if (!credentials) return null
        await dbConnect()
        const user = await User.findOne({ email: credentials.email }).lean()
        if (!user) return null

        const isValid = await verifyPassword(credentials.password, user.password)
        if (!isValid) return null

        return { id: String((user as any)._id), email: user.email, name: (user as any).fullName || '', role: (user as any).role || '', isApproved: (user as any).isApproved === true }
      },
    }),
  ],
  session: { strategy: 'jwt' },
  callbacks: {
    async jwt({ token, user }: any) {
      if (user?.id) {
        token.id = user.id
        token.role = user.role
        token.isApproved = user.isApproved
      }
      return token
    },
    async session({ session, token }: any) {
      if (token?.id) {
        ;(session as any).user = (session as any).user || {}
        ;((session as any).user as any).id = token.id
        ;((session as any).user as any).role = token.role
        ;((session as any).user as any).isApproved = token.isApproved
      }
      return session
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
} as any

export default NextAuth(authOptions)
