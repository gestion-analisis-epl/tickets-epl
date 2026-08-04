// Compartido entre components/ui/badge.tsx (mapea cada tono a clases Tailwind)
// y domain/catalogo/categoria.ts (el dominio no puede importar de components/,
// pero si necesita saber que valores de "tono" son validos al crear/editar
// una categoria).
export const BADGE_TONES = ["gray", "blue", "indigo", "purple", "teal", "green", "amber", "orange", "red"] as const;

export type BadgeTone = (typeof BADGE_TONES)[number];
