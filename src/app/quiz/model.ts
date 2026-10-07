import mongoose, { Schema, model, Document, Types } from "mongoose";

export interface IQuizQuestion {
  question: string;
  options: string[];
  correctAnswer: string;
}

export interface IQuiz extends Document {
  questions: IQuizQuestion[];
  rules: string;
  isActive: boolean;
  reward: number;
  createdAt: Date;
  updatedAt: Date;
}

const QuizSchema = new Schema<IQuiz>(
  {
    questions: {
      type: [
        {
          question: { type: String, required: true },
          options: { type: [String], required: true },
          correctAnswer: { type: String, required: true },
        },
      ],
      validate: {
        validator: (v: any[]) => v.length === 3,
        message: "A quiz must have exactly 3 questions",
      },
    },
    rules: { type: String, default: "" },
    isActive: { type: Boolean, default: true },
    reward: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export const Quiz = model<IQuiz>("Quiz", QuizSchema);

// ─── Submission ───────────────────────────────────────────────────────────────

export interface IQuizSubmission extends Document {
  quizId: mongoose.Types.ObjectId;
  studentId: mongoose.Types.ObjectId;
  name: string;
  idNumber: string;
  whatsappNumber: string;
  answers: string[];
  submittedAt: Date;
}

const QuizSubmissionSchema = new Schema<IQuizSubmission>(
  {
    quizId: { type: Schema.Types.ObjectId, ref: "Quiz", required: true },
    studentId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    name: { type: String, required: true },
    idNumber: { type: String, required: true },
    whatsappNumber: { type: String, required: true },
    answers: { type: [String], required: true },
    submittedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export const QuizSubmission = model<IQuizSubmission>(
  "QuizSubmission",
  QuizSubmissionSchema
);
