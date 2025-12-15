import mongoose, { Schema, model, models } from 'mongoose'

export interface IPartner {
  fullName?: string
  birthday?: Date | string
  licenseNumber?: string
  minWdsf?: string
  category?: string
}

export interface IPair extends mongoose.Document {
  club: mongoose.Types.ObjectId | string
  partner1?: IPartner
  partner2?: IPartner
  pairCategory?: string
  coach?: string
  ageCategory?: string
  classLevel?: string
  discipline?: string
  createdAt?: Date
  updatedAt?: Date
}

const PartnerSchema = new Schema<IPartner>({
  fullName: { type: String },
  birthday: { type: Date },
  licenseNumber: { type: String },
  minWdsf: { type: String },
  category: { type: String },
}, { _id: false })

const PairSchema = new Schema<IPair>({
  club: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  partner1: { type: PartnerSchema },
  partner2: { type: PartnerSchema },
  pairCategory: { type: String },
  coach: { type: String },
  ageCategory: { type: String },
  classLevel: { type: String },
  discipline: { type: String },
}, { timestamps: true })

const Pair = (models.Pair as mongoose.Model<IPair>) || model<IPair>('Pair', PairSchema)

export default Pair
