import { z } from "zod";
import { AiTeacherStyle, UserRole } from "@prisma/client";

export const usernameSchema = z
  .string()
  .trim()
  .min(3, "Username must be at least 3 characters")
  .max(24, "Username must be at most 24 characters")
  .regex(/^[a-zA-Z0-9_]+$/, "Only letters, numbers, and underscores");

export const registerBodySchema = z
  .object({
    username: usernameSchema,
    email: z.string().trim().email("Invalid email"),
    password: z.string().min(8, "Password must be at least 8 characters").max(72, "Password is too long"),
    confirmPassword: z.string().min(1, "Confirm your password"),
    firstName: z
      .string()
      .trim()
      .min(1, "First name is required")
      .max(64, "First name is too long"),
    lastName: z
      .string()
      .trim()
      .min(1, "Last name is required")
      .max(64, "Last name is too long"),
    country: z.string().trim().max(80).optional(),
    city: z.string().trim().max(80).optional(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export const profilePatchSchema = z.object({
  username: usernameSchema,
  firstName: z.string().trim().min(1, "First name is required").max(64),
  lastName: z.string().trim().min(1, "Last name is required").max(64),
  bio: z.string().max(5000),
  country: z.string().max(80),
  city: z.string().max(80),
  school: z.string().max(200),
  preferredLanguage: z.string().max(32),
  roleLabel: z.nativeEnum(UserRole),
  aiTeacherStyle: z.nativeEnum(AiTeacherStyle),
});

export type ProfilePatchInput = z.infer<typeof profilePatchSchema>;
