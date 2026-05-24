import { z } from "zod";
import { AiTeacherStyle, UserRole } from "@prisma/client";

export const usernameSchema = z
  .string()
  .trim()
  .min(3, "Numele de utilizator trebuie să aibă cel puțin 3 caractere")
  .max(24, "Numele de utilizator trebuie să aibă cel mult 24 de caractere")
  .regex(/^[a-zA-Z0-9_]+$/, "Doar litere, cifre și underscore");

export const registerBodySchema = z
  .object({
    username: usernameSchema,
    email: z.string().trim().email("Email invalid"),
    password: z.string().min(8, "Parola trebuie să aibă cel puțin 8 caractere").max(72, "Parola este prea lungă"),
    confirmPassword: z.string().min(1, "Confirmă parola"),
    firstName: z
      .string()
      .trim()
      .min(1, "Prenumele este obligatoriu")
      .max(64, "Prenumele este prea lung"),
    lastName: z
      .string()
      .trim()
      .min(1, "Numele de familie este obligatoriu")
      .max(64, "Numele de familie este prea lung"),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Parolele nu coincid",
    path: ["confirmPassword"],
  });

export const profilePatchSchema = z.object({
  username: usernameSchema,
  firstName: z.string().trim().min(1, "Prenumele este obligatoriu").max(64),
  lastName: z.string().trim().min(1, "Numele de familie este obligatoriu").max(64),
  bio: z.string().max(5000),
  school: z.string().max(200),
  preferredLanguage: z.string().max(32),
  roleLabel: z.nativeEnum(UserRole),
  aiTeacherStyle: z.nativeEnum(AiTeacherStyle),
});

export type ProfilePatchInput = z.infer<typeof profilePatchSchema>;
