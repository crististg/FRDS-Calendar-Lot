import mongoose, { Schema, model, models } from 'mongoose'

export interface IUser extends mongoose.Document {
  firstName?: string
  lastName?: string
  fullName?: string
  birthday?: Date | null
  role?: string
  cardNumber?: string
  clubName?: string
  clubCity?: string
  contactPerson?: string
  phone?: string
  pairs?: Array<mongoose.Types.ObjectId | string>
  email: string
  password: string
  resetPasswordToken?: string | null
  resetPasswordExpires?: Date | null
  isApproved?: boolean
  approvedBy?: mongoose.Types.ObjectId | string | null
  approvedAt?: Date | null
  createdAt?: Date
  updatedAt?: Date
}

const UserSchema = new Schema<IUser>({
  firstName: { type: String },
  lastName: { type: String },
  fullName: { type: String },
  birthday: { type: Date },
  role: { type: String },
  cardNumber: { type: String },
  clubName: { type: String },
  clubCity: { type: String },
  contactPerson: { type: String },
  phone: { type: String },
  pairs: [{ type: Schema.Types.ObjectId, ref: 'Pair' }],
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true },
  resetPasswordToken: { type: String },
  resetPasswordExpires: { type: Date },
  isApproved: { type: Boolean, default: false },
  approvedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  approvedAt: { type: Date, default: null },
}, { timestamps: true })

const User = (models.User as mongoose.Model<IUser>) || model<IUser>('User', UserSchema)

export default User
