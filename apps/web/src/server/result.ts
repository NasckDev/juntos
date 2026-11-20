import type * as z from "zod";
import { AccessError } from "./access-error";

/** Retorno padrão de toda Server Action (especificação 5.7). */
export type ActionResult<T> =
  | { readonly ok: true; readonly data: T }
  | { readonly ok: false; readonly error: string; readonly fieldErrors?: Readonly<Record<string, string>> };

export const GENERIC_ERROR = "Não foi possível concluir agora. Tente de novo em instantes.";

/** Erro de regra de negócio com mensagem pronta para a tela (e, se houver, o campo que causou). */
export class DomainError extends Error {
  override readonly name = "DomainError";
  readonly field: string | undefined;

  constructor(message: string, field?: string) {
    super(message);
    this.field = field;
  }
}

export function ok<T>(data: T): ActionResult<T> {
  return { ok: true, data };
}

export function fail(error: string, fieldErrors?: Readonly<Record<string, string>>): ActionResult<never> {
  return fieldErrors ? { ok: false, error, fieldErrors } : { ok: false, error };
}

/** Primeira mensagem de cada campo; a mensagem geral é a do primeiro problema. */
export function zodFailure(error: z.ZodError): ActionResult<never> {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.length > 0 ? issue.path.map(String).join(".") : "_";
    if (!(key in fieldErrors)) fieldErrors[key] = issue.message;
  }
  const first = error.issues[0]?.message ?? GENERIC_ERROR;
  return fail(first, fieldErrors);
}

/** Valida a entrada com Zod e executa a ação, convertendo erros conhecidos em `{ ok: false }`. */
export async function runAction<S extends z.ZodType, T>(
  schema: S,
  input: unknown,
  handler: (data: z.output<S>) => Promise<T>,
): Promise<ActionResult<T>> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return zodFailure(parsed.error);
  try {
    return ok(await handler(parsed.data));
  } catch (error: unknown) {
    return toFailure(error);
  }
}

export function toFailure(error: unknown): ActionResult<never> {
  if (error instanceof AccessError) return fail(error.message);
  if (error instanceof DomainError)
    return error.field ? fail(error.message, { [error.field]: error.message }) : fail(error.message);
  console.error("Erro inesperado numa ação do servidor:", error);
  return fail(GENERIC_ERROR);
}
