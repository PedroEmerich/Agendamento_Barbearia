function soDigitos(valor: string): string {
  return valor.replace(/\D/g, '');
}

/** Remove o 55 inicial quando o número já veio no formato internacional. */
function semDDI(digitos: string): string {
  return digitos.startsWith('55') && digitos.length >= 12 ? digitos.slice(2) : digitos;
}

/** Máscara progressiva para digitação: (11) 98765-4321 */
export function mascararTelefone(valor: string): string {
  const d = semDDI(soDigitos(valor)).slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : '';
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

/** Devolve o telefone como 55 + DDD + número (só dígitos), ou null se inválido. */
export function normalizarTelefone(valor: string): string | null {
  const d = semDDI(soDigitos(valor));
  if (d.length !== 10 && d.length !== 11) return null;
  if (Number(d.slice(0, 2)) < 11) return null;
  if (d.length === 11 && d[2] !== '9') return null;
  return `55${d}`;
}

export function formatarTelefone(normalizado: string): string {
  return mascararTelefone(normalizado);
}
