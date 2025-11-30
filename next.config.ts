import path from 'path'
import type { NextConfig } from 'next'

// Try to attach the bundle analyzer when ANALYZE=true. If it's not installed,
// fall back to the identity wrapper so normal dev flow keeps working.
let withBundleAnalyzer: any = (c: NextConfig) => c
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-unsafe-call
  const _bw = require('@next/bundle-analyzer')({ enabled: process.env.ANALYZE === 'true' })
  withBundleAnalyzer = _bw
} catch (e) {
  // analyzer missing — that's fine for non-analysis runs
}

const nextConfig: NextConfig = {
  /* config options here */
  reactStrictMode: true,
  // Note: swcMinify removed because Next 16+ warns about unrecognized key here.
  // Set the root used for output tracing so Next doesn't infer a parent workspace
  // when multiple lockfiles exist on the machine. This points to this project
  // directory and prevents the "inferred workspace root" warning.
  outputFileTracingRoot: path.resolve(__dirname),
}

export default withBundleAnalyzer(nextConfig)
