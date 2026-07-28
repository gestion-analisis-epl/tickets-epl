/*
 * Dominios de correo autorizados para iniciar sesion como solicitante. Como
 * el grupo usa varios dominios (no solo grupoepl.com.mx), no se puede usar el
 * parametro "hd" de Google (solo admite un dominio) — en vez de eso, se valida
 * el dominio del correo DESPUES del login.
 *
 * OJO: esta lista tambien esta duplicada en firestore.rules (las rules no
 * pueden importar TS) — si se agrega/quita un dominio, hay que actualizar
 * ambos lados.
 */
export const DOMINIOS_PERMITIDOS = [
  "sapanuncios.com.mx",
  "marketingqueretaro.com.mx",
  "grupoepl.com.mx",
  "sicmart.com.mx",
  "thebestmarketing.com.mx",
  "drauben.com.mx",
  "luminadigital.com.mx",
  "maopublicidad.com.mx",
  "serviciomsc.com.mx",
  "gmail.com",
  "kronosambiental.mx",
  "sapanuncios.com",
  "thebestmarketing.com",
];

export function dominioPermitido(email: string): boolean {
  const dominio = email.split("@")[1]?.toLowerCase();
  return !!dominio && DOMINIOS_PERMITIDOS.includes(dominio);
}
