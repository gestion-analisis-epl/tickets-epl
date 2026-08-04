import nodemailer from "nodemailer";

// Server-only (nodemailer necesita Node, no corre en cliente/Edge). Credenciales
// de Gmail SMTP: cuenta + App Password (myaccount.google.com/apppasswords),
// nunca la contrasena normal de la cuenta.
function buildTransport() {
  const user = process.env.SMTP_EMAIL_USER;
  const pass = process.env.SMTP_EMAIL_APP_PASSWORD;
  if (!user || !pass) {
    throw new Error("Falta SMTP_EMAIL_USER / SMTP_EMAIL_APP_PASSWORD en el entorno del servidor.");
  }
  return nodemailer.createTransport({ host: "smtp.gmail.com", port: 465, secure: true, auth: { user, pass } });
}

export interface EnviarEmailInput {
  to: string;
  subject: string;
  html: string;
}

export async function enviarEmail(input: EnviarEmailInput): Promise<void> {
  const transport = buildTransport();
  await transport.sendMail({
    from: `"Tickets Legal EPL" <${process.env.SMTP_EMAIL_USER}>`,
    to: input.to,
    subject: input.subject,
    html: input.html,
  });
}
