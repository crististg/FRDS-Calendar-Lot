import mongoose, { Schema, model, models } from 'mongoose'

export interface IEvent extends mongoose.Document {
  user: mongoose.Types.ObjectId
  title: string
  description?: string
  location?: string
  attendees?: mongoose.Types.ObjectId[]
  photos?: {
    blobId?: string
    url?: string
    filename?: string
    contentType?: string
    size?: number
    uploadedAt?: Date
    uploadedBy?: mongoose.Types.ObjectId
  }[]
  allDay?: boolean
  start: Date
  end?: Date | null
  createdAt?: Date
  updatedAt?: Date
}

const EventSchema = new Schema<IEvent>({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true },
  description: { type: String },
  location: { type: String },
  attendees: { type: [{ type: Schema.Types.ObjectId, ref: 'User' }], default: [] },
  photos: { type: [{ blobId: String, url: String, filename: String, contentType: String, size: Number, uploadedAt: Date, uploadedBy: { type: Schema.Types.ObjectId, ref: 'User' } }], default: [] },
  allDay: { type: Boolean, default: false },
  start: { type: Date, required: true },
  end: { type: Date },
}, { timestamps: true })

const Event = (models.Event as mongoose.Model<IEvent>) || model<IEvent>('Event', EventSchema)

export default Event
