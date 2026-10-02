
import { z } from "zod";

export const createTransactionSchema = z.object({
  title: z.object({
    en: z.string().min(1, { message: JSON.stringify({ en: "Title (English) is required", bn: "শিরোনাম (ইংরেজি) প্রয়োজন" }) }),
    bn: z.string().optional()
  }),
  img: z.string().optional()
});

export const updateTransactionSchema = createTransactionSchema.partial();
