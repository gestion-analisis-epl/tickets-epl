import nodemailer, { type Transporter } from "nodemailer";

// Server-only (nodemailer necesita Node, no corre en cliente/Edge). Credenciales
// de Gmail SMTP: cuenta + App Password (myaccount.google.com/apppasswords),
// nunca la contrasena normal de la cuenta.
//
// Cacheado a nivel de modulo (igual que firebase-admin.ts): abrir una
// conexion/login SMTP nueva por cada correo es lo que Gmail suele marcar
// como actividad sospechosa cuando se mandan varios seguidos (p.ej. el
// reenvio retroactivo) — con pool:true nodemailer reutiliza la conexion.
let cachedTransport: Transporter | undefined;

function getTransport(): Transporter {
  if (cachedTransport) return cachedTransport;

  const user = process.env.SMTP_EMAIL_USER;
  const pass = process.env.SMTP_EMAIL_APP_PASSWORD;
  if (!user || !pass) {
    throw new Error("Falta SMTP_EMAIL_USER / SMTP_EMAIL_APP_PASSWORD en el entorno del servidor.");
  }
  cachedTransport = nodemailer.createTransport({
    host: "smtp.gmail.com", port: 465, secure: true, auth: { user, pass },
    pool: true, maxConnections: 1, maxMessages: 100,
  });
  return cachedTransport;
}

export interface EnviarEmailInput {
  to: string;
  subject: string;
  html: string;
}

export async function enviarEmail(input: EnviarEmailInput): Promise<void> {
  await getTransport().sendMail({
    from: `"Tickets Legal EPL" <${process.env.SMTP_EMAIL_USER}>`,
    to: input.to,
    subject: input.subject,
    html: input.html,
  });
}
