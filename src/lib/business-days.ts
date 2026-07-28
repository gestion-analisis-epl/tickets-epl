/*
 * Equivalentes a WORKDAY() y NETWORKDAYS() del Excel original. Igual que las
 * formulas de la hoja Tickets, NO consideran dias festivos (el Excel tampoco
 * los tenia, ver la forma de 2 argumentos de WORKDAY(fecha, dias)).
 */

function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

// Equivalente a WORKDAY(start, days). Los SLA de "medio dia" (0.5) del
// catalogo se redondean a 1 dia habil completo (mas conservador que truncar
// a 0, que es lo que haria Excel con un valor no entero aqui).
export function addBusinessDays(start: Date, days: number): Date {
  let remaining = Math.round(days);
  const result = new Date(start);
  while (remaining > 0) {
    result.setDate(result.getDate() + 1);
    if (!isWeekend(result)) remaining--;
  }
  return result;
}

// Equivalente a NETWORKDAYS(start, end) - 1 (asi estaba la formula original
// en la hoja Tickets): dias habiles completos transcurridos, sin contar el
// dia de inicio.
export function businessDaysBetween(start: Date, end: Date): number {
  const cursor = new Date(start);
  cursor.setHours(0, 0, 0, 0);
  const endDay = new Date(end);
  endDay.setHours(0, 0, 0, 0);

  let count = 0;
  while (cursor < endDay) {
    cursor.setDate(cursor.getDate() + 1);
    if (!isWeekend(cursor)) count++;
  }
  return count;
}
