import "../styles/globals.css";
import { SessionProvider } from "next-auth/react";
import { SpeedInsights } from "@vercel/speed-insights/next"
import type { AppProps } from "next/app";

export default function App({ Component, pageProps: { session, ...pageProps } }: AppProps) {
  return <SessionProvider session={session}>
    <Component {...pageProps} />
    <SpeedInsights />
  </SessionProvider>;
}
