export type AccessErrorCode = "UNAUTHENTICATED" | "NOT_FOUND" | "FORBIDDEN";

const MESSAGES: Record<AccessErrorCode, string> = {
  UNAUTHENTICATED: "Sua sessão terminou. Entre de novo para continuar.",
  // A mesma resposta para "não existe" e "não é membro": quem não participa não descobre que o espaço existe.
  NOT_FOUND: "Não encontramos esse espaço.",
  FORBIDDEN: "Você não tem permissão para fazer isso neste espaço.",
};

const STATUS: Record<AccessErrorCode, 401 | 403 | 404> = {
  UNAUTHENTICATED: 401,
  NOT_FOUND: 404,
  FORBIDDEN: 403,
};

/** Erro de autorização tipado; vira 401/403/404 em Route Handlers e `{ ok: false }` em Server Actions. */
export class AccessError extends Error {
  override readonly name = "AccessError";
  readonly code: AccessErrorCode;
  readonly status: 401 | 403 | 404;

  constructor(code: AccessErrorCode, message: string = MESSAGES[code]) {
    super(message);
    this.code = code;
    this.status = STATUS[code];
  }
}

/** Resposta HTTP para Route Handlers. */
export function accessErrorResponse(error: AccessError): Response {
  return Response.json({ ok: false, error: error.message }, { status: error.status });
}
