import { todayInSaoPaulo } from "@juntos/core";

/*
 * Rótulos de tempo da central (`relTime` e `dayLabel` do protótipo). Sempre no fuso de São Paulo (decisão 14) e
 * com o "agora" vindo do servidor, para o HTML do servidor e o do navegador saírem iguais.
 */

const TIME_ZONE = "America/Sao_Paulo";
const DAY_MS = 86_400_000;
const MINUTE_MS = 60_000;

const hourFormat = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: TIME_ZONE });
const longDay = new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "long", timeZone: TIME_ZONE });
const shortDay = new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "short", timeZone: TIME_ZONE });

function dayKind(date: Date, now: Date): "today" | "yesterday" | "older" {
  const day = todayInSaoPaulo(date);
  if (day === todayInSaoPaulo(now)) return "today";
  if (day === todayInSaoPaulo(new Date(now.getTime() - DAY_MS))) return "yesterday";
  return "older";
}

/** "Hoje", "Ontem" ou "18 de novembro". */
export function dayLabel(iso: string, nowIso: string): string {
  const date = new Date(iso);
  const kind = dayKind(date, new Date(nowIso));
  if (kind === "today") return "Hoje";
  if (kind === "yesterday") return "Ontem";
  return longDay.format(date);
}

/** "agora", "há 5 min", "hoje às 09:30", "ontem às 18:02" ou "18 de nov. às 07:00". */
export function relativeTime(iso: string, nowIso: string): string {
  const date = new Date(iso);
  const now = new Date(nowIso);
  const minutes = (now.getTime() - date.getTime()) / MINUTE_MS;
  if (minutes < 1) return "agora";
  if (minutes < 60) return `há ${Math.round(minutes)} min`;
  const hour = hourFormat.format(date);
  const kind = dayKind(date, now);
  if (kind === "today") return `hoje às ${hour}`;
  if (kind === "yesterday") return `ontem às ${hour}`;
  return `${shortDay.format(date)} às ${hour}`;
}
