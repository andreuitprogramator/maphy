import { requireUser } from "@/lib/auth/session";
import { jsonError, jsonOk } from "@/lib/api/response";
import { sendTeacherRequestEmail } from "@/lib/email/mailer";
import { rateLimit } from "@/lib/rate-limit";

export async function POST() {
  const user = await requireUser();
  if (!user) return jsonError(401, "Neautentificat");

  const rl = rateLimit({ key: `teacher-request:${user.id}`, limit: 3, windowMs: 24 * 60 * 60 * 1000 });
  if (!rl.ok) return jsonError(429, "Prea multe cereri. Încearcă mâine.");

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
  const approveUrl = `${baseUrl}/api/admin/promote-teacher?userId=${user.id}&secret=${process.env.ADMIN_SECRET ?? "dev-secret"}`;

  await sendTeacherRequestEmail({
    firstName: user.firstName,
    lastName: user.lastName,
    username: user.username,
    email: user.email,
    approveUrl,
  });

  return jsonOk({ message: "Cerere trimisă." });
}
