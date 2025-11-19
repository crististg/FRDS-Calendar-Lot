import { MongoClient } from 'mongodb'

const uri = process.env.MONGODB_URI || ''
let client: MongoClient | null = null
let clientPromise: Promise<MongoClient> | null = null

if (!uri) {
  throw new Error('Please define the MONGODB_URI environment variable inside .env.local')
}

if (!client) {
  client = new MongoClient(uri)
  clientPromise = client.connect()
}

export default clientPromise as Promise<MongoClient>

export async function getDb() {
  if (!clientPromise) {
    throw new Error('MongoClient is not initialized')
  }
  const cl = await clientPromise
  // If MONGODB_DB is set, use it, otherwise default DB from URI
  const dbName = process.env.MONGODB_DB || undefined
  return dbName ? cl.db(dbName) : cl.db()
}
