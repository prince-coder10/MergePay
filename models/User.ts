import mongoose, { Schema, Document } from "mongoose";

export interface IUser extends Document<string> {
  githubUsername?: string;
  name?: string;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema: Schema = new Schema(
  {
    _id: { type: String, required: true }, // Wallet address as the primary key
    githubUsername: { type: String, sparse: true, unique: true },
    name: { type: String },
  },
  {
    timestamps: true,
  }
);

export default mongoose.models.User ||
  mongoose.model<IUser>("User", UserSchema);
