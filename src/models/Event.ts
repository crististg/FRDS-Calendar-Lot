import mongoose, { Schema, model, models } from 'mongoose'

export interface IEvent extends mongoose.Document {
  user: mongoose.Types.ObjectId
  title: string
  description?: string
  eventType?: 'WDSF' | 'Open' | 'Invitational'
  country?: string
  city?: string
  address?: string
  attendingPairs?: mongoose.Types.ObjectId[]
  judges?: mongoose.Types.ObjectId[]
  photos?: {
    blobId?: string
    url?: string
    filename?: string
    contentType?: string
    size?: number
    uploadedAt?: Date
    uploadedBy?: mongoose.Types.ObjectId
    pairId?: mongoose.Types.ObjectId
  }[]
  // results are stored separately from photos
  results?: {
    pairId?: mongoose.Types.ObjectId
    photoId?: mongoose.Types.ObjectId
    place?: number
    round?: string
    category?: string
    score?: number
    participants?: number
    createdAt?: Date
    createdBy?: mongoose.Types.ObjectId
  }[]
  allDay?: boolean
  start: Date
  end?: Date | null
  isApproved?: boolean
  approvedBy?: mongoose.Types.ObjectId | null
  approvedAt?: Date | null
  createdAt?: Date
  updatedAt?: Date
}

const EventSchema = new Schema<IEvent>({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true },
  description: { type: String },
  eventType: { type: String, enum: ['WDSF', 'Open', 'Invitational'], default: 'Open' },
  country: { type: String },
  city: { type: String },
  address: { type: String },
  attendingPairs: { type: [{ type: Schema.Types.ObjectId, ref: 'Pair' }], default: [] },
  judges: { type: [{ type: Schema.Types.ObjectId, ref: 'User' }], default: [] },
  photos: { type: [{ blobId: String, url: String, filename: String, contentType: String, size: Number, uploadedAt: Date, uploadedBy: { type: Schema.Types.ObjectId, ref: 'User' }, pairId: { type: Schema.Types.ObjectId, ref: 'Pair' } }], default: [] },
  results: { type: [{ pairId: { type: Schema.Types.ObjectId, ref: 'Pair' }, photoId: Schema.Types.ObjectId, place: Number, round: String, category: String, score: Number, participants: Number, createdAt: Date, createdBy: { type: Schema.Types.ObjectId, ref: 'User' } }], default: [] },
  allDay: { type: Boolean, default: false },
  start: { type: Date, required: true },
  end: { type: Date },
  isApproved: { type: Boolean, default: false },
  approvedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  approvedAt: { type: Date, default: null },
}, { timestamps: true })

const Event = (models.Event as mongoose.Model<IEvent>) || model<IEvent>('Event', EventSchema)

export default Event
