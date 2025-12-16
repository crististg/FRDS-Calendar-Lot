import mongoose, { Schema, Document } from 'mongoose'

interface IClubSolicitation extends Document {
  clubId: mongoose.Types.ObjectId
  eventId: mongoose.Types.ObjectId
  status: 'pending' | 'approved' | 'rejected'
  message?: string
  requestedAt: Date
  respondedAt?: Date
  respondedBy?: mongoose.Types.ObjectId
}

const ClubSolicitationSchema = new Schema<IClubSolicitation>(
  {
    clubId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    eventId: {
      type: Schema.Types.ObjectId,
      ref: 'Event',
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
    },
    message: {
      type: String,
      default: '',
    },
    requestedAt: {
      type: Date,
      default: Date.now,
    },
    respondedAt: {
      type: Date,
      default: null,
    },
    respondedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  { timestamps: true }
)

// Compound index to prevent duplicate solicitations
ClubSolicitationSchema.index({ clubId: 1, eventId: 1 }, { unique: true })

export default mongoose.models.ClubSolicitation ||
  mongoose.model<IClubSolicitation>('ClubSolicitation', ClubSolicitationSchema)
