import mongoose, { Schema, model, models } from 'mongoose'

export interface IUser extends mongoose.Document {
  firstName?: string
  lastName?: string
  fullName?: string
  birthday?: Date | null
  role?: string
  cardNumber?: string
  email: string
  password: string
  resetPasswordToken?: string | null
  resetPasswordExpires?: Date | null
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
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true },
  resetPasswordToken: { type: String },
  resetPasswordExpires: { type: Date },
}, { timestamps: true })

const User = (models.User as mongoose.Model<IUser>) || model<IUser>('User', UserSchema)

export default User
