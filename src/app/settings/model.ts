import mongoose, { Schema, Document, ObjectId } from "mongoose";

export interface ISettings extends Document {
  siteName: string;
  logo: string;
  metaTitle: string;
  metaDescription: string;
  metaKeywords: string;
  paymentMethods: {
    name: string;
    phoneNumber: string;
  }[];
  depositRules: {
    minAmount: number;
    maxAmount: number;
    allowedMethods: string[];
    processingTime: string;
    instructions: string;
    customInstructions: string[];
  };
  withdrawRules: {
    minAmount: number;
    maxAmount: number;
    processingTime: string;
    instructions: string;
    dailyLimit: number;
    customInstructions: string[];
  };
  admissionFee: number;
  withdrawalFee: number;
  teamLeaderMinBalance: number;
  activationCommission: {
    referrer: number;
    referrerOfReferrer: number;
    trainer: number;
    teamLeader: number;
    seniorTeamLeader: number;
    councilor: number;
  };
  defaultTeamLeaderId: string;
  supportMeetingLink: string;
  supportWhatsAppLink: string;
  helpLink: string;
  courses: {
    _id: ObjectId;
    title: string;
    image: string | null;
    link: string;
    teacherId: string | null;
    awardValue: number;
    isAwardEnabled: boolean;
  }[];
  deliveryChargeInsideDhaka: number;
  deliveryChargeOutsideDhaka: number;
  classStartTime: string;
  classEndTime: string;
  banners: {
    desktopImage: string;
    mobileImage: string;
    link?: string;
  }[];
  welcomeDesktop: string;
  welcomeMobile: string;
  roleSalaries: {
    admin: number;
    auditor: number;
    checker: number;
    controller: number;
    councilor: number;
    "super-admin": number;
    "lead-checker": number;
    teacher: number;
    accountant: number;
  };
  imageOfEarningRules: string;
  quizRules: string;
}

const settingsSchema = new Schema<ISettings>(
  {
    siteName: { type: String, default: "My App" },
    logo: { type: String, default: "" },
    metaTitle: { type: String, default: "My App" },
    metaDescription: { type: String, default: "" },
    metaKeywords: { type: String, default: "" },
    admissionFee: { type: Number, default: 0 },
    withdrawalFee: { type: Number, default: 0 },
    teamLeaderMinBalance: { type: Number, default: 0 },
    activationCommission: {
      referrer: { type: Number, default: 0 },
      referrerOfReferrer: { type: Number, default: 0 },
      trainer: { type: Number, default: 0 },
      teamLeader: { type: Number, default: 0 },
      seniorTeamLeader: { type: Number, default: 0 },
      councilor: { type: Number, default: 0 },
    },
    defaultTeamLeaderId: { type: String, default: "" },
    supportMeetingLink: { type: String, default: "" },
    supportWhatsAppLink: { type: String, default: "" },
    helpLink: { type: String, default: "" },
    courses: {
      type: [
        {
          title: { type: String, required: true },
          image: { type: String, default: null },
          link: { type: String },
          teacherId: { type: String, default: null },
          awardValue: { type: Number, default: 0 },
          isAwardEnabled: { type: Boolean, default: false },
        },
      ],
      default: [],
    },
    paymentMethods: {
      type: [
        {
          name: { type: String, required: true },
          phoneNumber: { type: String, required: true },
        },
      ],
      default: [],
    },
    depositRules: {
      minAmount: { type: Number, default: 10 },
      maxAmount: { type: Number, default: 10000 },
      allowedMethods: {
        type: [String],
        default: ["Bank Transfer", "Mobile Banking", "PayPal"],
      },
      processingTime: { type: String, default: "24-48 hours" },
      instructions: {
        type: String,
        default: "Please provide valid transaction ID",
      },
      customInstructions: { type: [String], default: [] },
    },
    withdrawRules: {
      minAmount: { type: Number, default: 20 },
      maxAmount: { type: Number, default: 5000 },
      processingTime: { type: String, default: "1-3 business days" },
      instructions: {
        type: String,
        default: "Withdrawals are processed to your registered account only",
      },
      dailyLimit: { type: Number, default: 1000 },
      customInstructions: { type: [String], default: [] },
    },
    deliveryChargeInsideDhaka: { type: Number, default: 0 },
    deliveryChargeOutsideDhaka: { type: Number, default: 0 },
    classStartTime: { type: String, default: "" },
    classEndTime: { type: String, default: "" },
    banners: {
      type: [
        {
          desktopImage: { type: String, required: true },
          mobileImage: { type: String, required: true },
          link: { type: String, default: "" },
        },
      ],
      default: [],
    },
    welcomeDesktop: { type: String, default: "" },
    welcomeMobile: { type: String, default: "" },
    roleSalaries: {
      admin: { type: Number, default: 0 },
      auditor: { type: Number, default: 0 },
      checker: { type: Number, default: 0 },
      controller: { type: Number, default: 0 },
      councilor: { type: Number, default: 0 },
      "super-admin": { type: Number, default: 0 },
      "lead-checker": { type: Number, default: 0 },
      teacher: { type: Number, default: 0 },
      accountant: { type: Number, default: 0 },
    },
    imageOfEarningRules: { type: String, default: "" },
    quizRules: { type: String, default: "" },
  },
  { timestamps: true }
);

export const Settings = mongoose.model<ISettings>("Settings", settingsSchema);
