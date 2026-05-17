import { z } from "zod";

export type GradingBreakdownItem = {
  label: string;
  points: number;
  maxPoints: number;
  notes?: string;
};

export const GraderModelResultSchema = z
  .object({
    readability: z.enum(["readable", "rejected"]),
    reason: z.string().nullable(),
    score: z.number().nullable(),
    short_feedback: z.string().nullable(),
    rubric_breakdown: z.array(
      z.object({
        label: z.string().min(1),
        points: z.number(),
        maxPoints: z.number().positive(),
        notes: z.string(),
      }),
    ),
    detected_strengths: z.array(z.string()),
    detected_mistakes: z.array(z.string()),
    final_feedback: z.string().nullable(),
    attempted_subparts: z.array(z.enum(["A", "B", "C", "D", "E"])).optional(),
  })
  .superRefine((v, ctx) => {
    if (v.readability === "rejected") {
      if (!v.reason || v.reason.trim().length === 0) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Rejected output requires a reason" });
      }
      return;
    }
    if (v.score === null) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Readable output requires score" });
    }
    if (!v.short_feedback) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Readable output requires short_feedback" });
    }
    if (!v.final_feedback) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Readable output requires final_feedback" });
    }
  });

export type GraderModelResult = z.infer<typeof GraderModelResultSchema>;

export type GradeServiceResult =
  | {
      status: "BLURRY_REJECTED";
      imageQualityReason: string;
    }
  | {
      status: "GRADED";
      aiScore: number;
      aiFeedback: string;
      aiBreakdown: {
        rubric_breakdown: GradingBreakdownItem[];
        detected_strengths: string[];
        detected_mistakes: string[];
      };
      reviewedAt: Date;
      visibilityUnlocked: boolean;
    };

