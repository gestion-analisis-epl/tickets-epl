import type { TipoNotificacion } from "./notificacion";

// Datos del ticket ya resueltos a texto legible (nombres, no ids). Todo es opcional:
// la tarjeta solo pinta lo que viene informado.
export interface DatosTicketEmail {
  solicitante?: string;
  servicio?: string;
  categoria?: string;
  sitio?: string;
  estatus?: string;
  abogado?: string;
  fechaSolicitud?: string;
  fechaCompromiso?: string;
  fechaCierre?: string;
}

export interface DatosEmailNotificacion {
  tipo: TipoNotificacion;
  mensaje: string;
  folio: string;
  verTicketUrl: string;
  calificarUrl: string | null;
  logoUrl?: string;
  ticket: DatosTicketEmail;
}

type CampoTicket = keyof DatosTicketEmail;

const AZUL = "#0b3b89";
const VERDE = "#0f482d";
const AMBAR = "#f4ae34";

export const ACENTO_POR_TIPO: Record<TipoNotificacion, string> = {
  nuevo_ticket: AZUL,
  creacion_solicitante: AZUL,
  asignacion: AZUL,
  asignacion_solicitante: AZUL,
  cambio_estatus: AZUL,
  reasignacion: AMBAR,
  reasignacion_solicitante: AMBAR,
  cierre: VERDE,
};

const ETIQUETA_POR_TIPO: Record<TipoNotificacion, string> = {
  nuevo_ticket: "Nuevo ticket",
  creacion_solicitante: "Ticket creado",
  asignacion: "Asignacion de abogado",
  asignacion_solicitante: "Responsable asignado",
  cambio_estatus: "Cambio de estatus",
  reasignacion: "Reasignacion de abogado",
  reasignacion_solicitante: "Tu ticket fue reasignado",
  cierre: "Cierre de ticket",
};

const ETIQUETA_CAMPO: Record<CampoTicket, string> = {
  solicitante: "Solicitante",
  servicio: "Servicio",
  categoria: "Categoria",
  sitio: "Sitio",
  estatus: "Estatus",
  abogado: "Abogado",
  fechaSolicitud: "Fecha de solicitud",
  fechaCompromiso: "Fecha compromiso",
  fechaCierre: "Fecha de cierre",
};

// Que campos se muestran (y en que orden) segun el tipo de correo.
const CAMPOS_POR_TIPO: Record<TipoNotificacion, CampoTicket[]> = {
  nuevo_ticket: ["solicitante", "servicio", "categoria", "sitio", "fechaSolicitud"],
  creacion_solicitante: ["servicio", "categoria", "sitio", "fechaSolicitud"],
  asignacion: ["abogado", "solicitante", "servicio", "categoria", "sitio", "fechaCompromiso"],
  asignacion_solicitante: ["abogado", "servicio", "categoria", "sitio", "fechaCompromiso"],
  reasignacion: ["abogado", "solicitante", "servicio", "categoria", "sitio", "fechaCompromiso"],
  reasignacion_solicitante: ["abogado", "servicio", "categoria", "sitio", "fechaCompromiso"],
  cambio_estatus: ["estatus", "servicio", "abogado", "sitio"],
  cierre: ["estatus", "servicio", "abogado", "sitio", "fechaCierre"],
};

// Texto sobre el acento: el ambar es claro, necesita texto oscuro (mismo criterio que --warning-foreground).
const TEXTO_SOBRE_ACENTO: Record<string, string> = { [AMBAR]: "#0a0a0a" };

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

export function formatearFecha(iso: string | null | undefined): string | undefined {
  if (!iso) return undefined;
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return undefined;
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Mexico_City", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(fecha).split("-");
  return `${Number(partes[2])} ${MESES[Number(partes[1]) - 1]} ${partes[0]}`;
}

export function escaparHtml(texto: string): string {
  return texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const FUENTE = "font-family:Segoe UI,Helvetica,Arial,sans-serif";
const GRIS = "#5b6472";
const BORDE = "#e3e7ee";

function encabezado(logoUrl: string | undefined): string {
  const marca = logoUrl
    ? `<img src="${escaparHtml(logoUrl)}" alt="Grupo EPL" height="48" style="display:block;border:0;height:48px;width:auto">`
    : `<span style="${FUENTE};font-size:26px;font-weight:700;color:#455f6e;letter-spacing:-0.5px">grupo epl</span>`;
  return `<tr><td style="padding:20px 28px;background:#ffffff;border-bottom:1px solid ${BORDE}">${marca}</td></tr>`;
}

function franja(tipo: TipoNotificacion): string {
  const acento = ACENTO_POR_TIPO[tipo];
  const texto = TEXTO_SOBRE_ACENTO[acento] ?? "#ffffff";
  return `<tr><td style="padding:12px 28px;background:${acento};color:${texto};${FUENTE};font-size:13px;font-weight:700;letter-spacing:0.6px;text-transform:uppercase">${escaparHtml(ETIQUETA_POR_TIPO[tipo])}</td></tr>`;
}

function tarjetaDatos(tipo: TipoNotificacion, ticket: DatosTicketEmail): string {
  const filas = CAMPOS_POR_TIPO[tipo]
    .filter((campo) => ticket[campo])
    .map((campo) => `<tr>
        <td style="padding:6px 0;width:38%;color:${GRIS};${FUENTE};font-size:13px;vertical-align:top">${ETIQUETA_CAMPO[campo]}</td>
        <td style="padding:6px 0;color:#111827;${FUENTE};font-size:14px;font-weight:600;vertical-align:top">${escaparHtml(ticket[campo] as string)}</td>
      </tr>`)
    .join("");
  if (!filas) return "";
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:20px;border:1px solid ${BORDE};border-radius:8px;background:#f8f9fb">
      <tr><td style="padding:14px 18px">
        <div style="${FUENTE};font-size:12px;font-weight:700;color:${GRIS};letter-spacing:0.6px;text-transform:uppercase;padding-bottom:6px">Datos del ticket</div>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${filas}</table>
      </td></tr>
    </table>`;
}

function boton(url: string, texto: string, fondo: string, color = "#ffffff"): string {
  return `<a href="${escaparHtml(url)}" style="display:inline-block;padding:12px 22px;background:${fondo};color:${color};${FUENTE};font-size:14px;font-weight:600;text-decoration:none;border-radius:6px">${texto}</a>`;
}

export function renderEmailNotificacion(datos: DatosEmailNotificacion): string {
  const botones = [
    boton(datos.verTicketUrl, "Ver ticket", AZUL),
    datos.calificarUrl ? boton(datos.calificarUrl, "Calificar tu experiencia", VERDE) : "",
  ].filter(Boolean).join('<span style="display:inline-block;width:10px"></span>');

  return `<!doctype html>
<html lang="es">
<body style="margin:0;padding:0;background:#eef1f5">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef1f5">
    <tr><td align="center" style="padding:24px 12px">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:#ffffff;border:1px solid ${BORDE};border-radius:10px;overflow:hidden">
        ${encabezado(datos.logoUrl)}
        ${franja(datos.tipo)}
        <tr><td style="padding:28px">
          <div style="${FUENTE};font-size:12px;color:${GRIS};padding-bottom:8px">Ticket <strong style="color:#111827">${escaparHtml(datos.folio)}</strong></div>
          <div style="${FUENTE};font-size:16px;line-height:1.5;color:#111827">${escaparHtml(datos.mensaje)}</div>
          ${tarjetaDatos(datos.tipo, datos.ticket)}
          <div style="padding-top:24px">${botones}</div>
        </td></tr>
        <tr><td style="padding:16px 28px;background:#f8f9fb;border-top:1px solid ${BORDE};${FUENTE};font-size:12px;line-height:1.5;color:${GRIS}">
          Correo automatico de Tickets Legal EPL, no respondas a este mensaje.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
