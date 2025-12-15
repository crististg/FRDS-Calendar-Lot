import mongoose from 'mongoose'

const MONGODB_URI = process.env.MONGODB_URI || ''

if (!MONGODB_URI) {
  throw new Error('Please define the MONGODB_URI environment variable inside .env.local')
}

/**
 * Global is used here to maintain a cached connection across hot reloads in development.
 * This prevents connections growing exponentially during API route calls.
 */
let cached: { conn: typeof mongoose | null; promise: Promise<typeof mongoose> | null } = (global as any)._mongoose || { conn: null, promise: null }

if (!cached.promise) {
  const opts = {
    bufferCommands: false,
    // Connection pooling options for better performance
    maxPoolSize: 10,
    minPoolSize: 2,
    // Timeout settings
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
    // Connection string parsing
    retryWrites: true,
  }
  cached.promise = mongoose.connect(MONGODB_URI, opts).then((m) => m)
  ;(global as any)._mongoose = cached
}

export default async function dbConnect() {
  if (cached.conn) return cached.conn
  cached.conn = await cached.promise
  return cached.conn
}
