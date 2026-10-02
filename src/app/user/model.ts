import mongoose, { Schema, model, Document, ObjectId } from "mongoose";
import { Counter } from "./counter";

export interface IUser extends Document {
  name: string;
  country: string;
  language: string;
  email: string;
  isActive: boolean;
  activationDate?: Date;
  phone: string;
  password: string;
  userId: string;
  referrer: ObjectId;
  trainer: ObjectId;
  teamLeader: ObjectId;
  councilor: ObjectId;
  seniorTeamLeader: ObjectId;
  role:
    | "accountant"
    | "admin"
    | "auditor"
    | "checker"
    | "controller"
    | "councilor"
    | "super-admin"
    | "lead-checker"
    | "senior-team-leader"
    | "student"
    | "teacher"
    | "team-leader"
    | "trainer";

  image?: string;
  coverImage?: string;
  withdrawNumber: {
    number: string;
    method: string;
  };
  withdrawalFeePaid: boolean;
  messagedBy: {
    by: ObjectId;
    byName: string;
    byRole: string;
    at: Date;
  }[];
}

const UserSchema = new Schema<IUser>(
  {
    name: { type: String, required: true },
    country: { type: String },
    language: { type: String },
    email: { type: String },
    isActive: { type: Boolean, default: false },
    activationDate: { type: Date },
    phone: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    userId: { type: String, unique: true },
    referrer: { type: Schema.Types.ObjectId, ref: "User", required: true },
    trainer: { type: Schema.Types.ObjectId, ref: "User", default: null },
    teamLeader: { type: Schema.Types.ObjectId, ref: "User", default: null },
    seniorTeamLeader: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    councilor: { type: Schema.Types.ObjectId, ref: "User", default: null },
    role: {
      type: String,
      enum: [
        "accountant",
        "admin",
        "auditor",
        "checker",
        "controller",
        "councilor",
        "super-admin",
        "lead-checker",
        "senior-team-leader",
        "student",
        "teacher",
        "team-leader",
        "trainer",
      ],
      default: "student",
    },
    image: { type: String },
    coverImage: { type: String },
    withdrawNumber: {
      number: { type: String },
      method: { type: String },
    },
    withdrawalFeePaid: { type: Boolean, default: false },
    messagedBy: [
      {
        by: { type: Schema.Types.ObjectId, ref: "User" },
        byName: { type: String },
        byRole: { type: String },
        at: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

UserSchema.pre("save", async function (next) {
  // Only generate userId once — when the document is brand new
  // Using this.isNew prevents re-generation on any subsequent .save() call
  // (e.g. toggleUserStatus, changePassword, activateAccount, etc.)
  if (this.isNew && !this.userId) {
    const counter = await Counter.findByIdAndUpdate(
      "userId",
      { $inc: { seq: 1 } },
      { new: true, upsert: true }
    );
    const year = new Date().getFullYear().toString().slice(-2);
    this.userId = `HS${year}${counter.seq}`;
  }
  next();
});

export const User = model<IUser>("User", UserSchema);
