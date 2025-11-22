import { GetServerSideProps } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from './api/auth/[...nextauth]'

export default function HomePage() {
  return (
    <main />
  )
}

export const getServerSideProps: GetServerSideProps = async (context) => {
  const session = await getServerSession(context.req, context.res, authOptions as any)
  if (session) {
    return {
      redirect: {
        destination: '/app',
        permanent: false,
      },
    }
  }

  return {
    redirect: {
      destination: '/login',
      permanent: false,
    },
  }
}