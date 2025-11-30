import "../styles/globals.css";
import { SessionProvider } from "next-auth/react";
import dynamic from 'next/dynamic'
import type { AppProps } from "next/app";

// SpeedInsights is useful for CI/analysis but should not be bundled into
// every client page in production. Enable it only when the env flag is set.
const SpeedInsights = process.env.NEXT_PUBLIC_ENABLE_SPEED_INSIGHTS === 'true'
  ? dynamic(() => import('@vercel/speed-insights/next').then(m => m.SpeedInsights), { ssr: false })
  : null

export default function App({ Component, pageProps: { session, ...pageProps } }: AppProps) {
  return <SessionProvider session={session}>
    <Component {...pageProps} />
    {/* Render SpeedInsights only when explicitly enabled via NEXT_PUBLIC_ENABLE_SPEED_INSIGHTS */}
    {SpeedInsights ? <SpeedInsights /> : null}
  </SessionProvider>;
}
