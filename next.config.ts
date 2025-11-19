import path from 'path'
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  /* config options here */
  reactStrictMode: true,
  // Set the root used for output tracing so Next doesn't infer a parent workspace
  // when multiple lockfiles exist on the machine. This points to this project
  // directory and prevents the "inferred workspace root" warning.
  outputFileTracingRoot: path.resolve(__dirname),
}

export default nextConfig
