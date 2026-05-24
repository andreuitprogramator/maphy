import nodemailer from "nodemailer";

function createTransport() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT ?? 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) return null;

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
}

export async function sendTeacherRequestEmail(args: {
  firstName: string;
  lastName: string;
  username: string;
  email: string;
  approveUrl: string;
}) {
  const transport = createTransport();
  const from = process.env.SMTP_FROM ?? process.env.SMTP_USER ?? "noreply@maphy.ro";
  const to = "radu.pipernea@yahoo.com";

  if (!transport) {
    console.log(`[email] Teacher request from @${args.username}: ${args.approveUrl}`);
    return;
  }

  await transport.sendMail({
    from: `"Maphy" <${from}>`,
    to,
    subject: `Cerere profesor: ${args.firstName} ${args.lastName} (@${args.username})`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
        <h2 style="color:#111">Cerere acces profesor</h2>
        <p><strong>Nume:</strong> ${args.firstName} ${args.lastName}</p>
        <p><strong>Username:</strong> @${args.username}</p>
        <p><strong>Email:</strong> ${args.email}</p>
        <a href="${args.approveUrl}" style="display:inline-block;margin:16px 0;padding:12px 24px;background:#2563eb;color:#fff;border-radius:8px;text-decoration:none;font-weight:600">
          Aprobă cererea
        </a>
      </div>
    `,
  });
}

export async function sendPasswordResetEmail(to: string, resetUrl: string) {
  const transport = createTransport();
  const from = process.env.SMTP_FROM ?? process.env.SMTP_USER ?? "noreply@maphy.ro";

  if (!transport) {
    console.log(`[email] Password reset link for ${to}: ${resetUrl}`);
    return;
  }

  await transport.sendMail({
    from: `"Maphy" <${from}>`,
    to,
    subject: "Resetează parola — Maphy",
    text: `Bună!\n\nAi solicitat resetarea parolei. Apasă pe linkul de mai jos:\n${resetUrl}\n\nLinkul expiră în 1 oră.\n\nDacă nu ai solicitat resetarea parolei, ignoră acest email.`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
        <h2 style="color:#111">Resetează parola</h2>
        <p>Bună! Apasă butonul de mai jos pentru a-ți reseta parola pe Maphy.</p>
        <a href="${resetUrl}" style="display:inline-block;margin:16px 0;padding:12px 24px;background:#2563eb;color:#fff;border-radius:8px;text-decoration:none;font-weight:600">
          Resetează parola
        </a>
        <p style="color:#666;font-size:13px">Linkul expiră în 1 oră. Dacă nu ai solicitat resetarea parolei, ignoră acest email.</p>
      </div>
    `,
  });
}

export async function sendVerificationEmail(to: string, verifyUrl: string) {
  const transport = createTransport();
  const from = process.env.SMTP_FROM ?? process.env.SMTP_USER ?? "noreply@maphy.ro";

  if (!transport) {
    // No SMTP configured — print to console so dev can verify manually
    console.log(`[email] Verification link for ${to}: ${verifyUrl}`);
    return;
  }

  await transport.sendMail({
    from: `"Maphy" <${from}>`,
    to,
    subject: "Verifică-ți adresa de email — Maphy",
    text: `Bună!\n\nApasă pe linkul de mai jos pentru a-ți verifica adresa de email:\n${verifyUrl}\n\nLinkul expiră în 24 de ore.\n\nDacă nu ai creat un cont pe Maphy, ignoră acest email.`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
        <h2 style="color:#111">Verifică-ți adresa de email</h2>
        <p>Bună! Apasă butonul de mai jos pentru a-ți confirma adresa de email pe Maphy.</p>
        <a href="${verifyUrl}" style="display:inline-block;margin:16px 0;padding:12px 24px;background:#2563eb;color:#fff;border-radius:8px;text-decoration:none;font-weight:600">
          Verifică emailul
        </a>
        <p style="color:#666;font-size:13px">Linkul expiră în 24 de ore. Dacă nu ai creat un cont pe Maphy, ignoră acest email.</p>
      </div>
    `,
  });
}
