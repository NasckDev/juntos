import type { Cents, IsoDate, Kind, Recurrence, Role, Tx, YearMonth } from "@juntos/core";

/*
 * Formatos de leitura das telas financeiras. São tipos puros (sem código de servidor): os componentes de cliente
 * importam com `import type`.
 *
 * `TxView` e `RecurrenceView` são os tipos do core (`Tx`, `Recurrence`) com `categoryId` = id (uuid) da categoria
 * no banco. `recurrenceId` só vem preenchido quando a conta fixa ainda existe (excluída = histórico solto).
 */

export type TxView = Tx;

export interface RecurrenceView extends Recurrence {
  /** Mês do último lançamento (parcelados): igual a `start + installmentsTotal - 1`. Nulo sem fim. */
  readonly endCompetence: YearMonth | null;
}

export interface CategoryView {
  readonly id: string;
  /** Chave estável das categorias padrão ("moradia", "assin"); nula nas criadas pelo espaço. */
  readonly key: string | null;
  readonly name: string;
  readonly icon: string;
  readonly hue: number;
  readonly kind: Kind;
}

export interface MemberOption {
  readonly id: string;
  readonly name: string;
  readonly avatar: string | null;
  readonly isYou: boolean;
}

/** Último lançamento com o mesmo nome (para repetir categoria, valor, forma e pessoa ao digitar). */
export interface DescriptionMemory {
  readonly kind: Kind;
  readonly description: string;
  readonly amount: Cents;
  readonly categoryId: string;
  readonly paymentMethod: string;
  readonly paidBy: string | null;
}

/** O que o formulário de lançamento precisa, carregado uma vez pelo layout. */
export interface EntryFormData {
  readonly spaceId: string;
  readonly role: Role;
  readonly today: IsoDate;
  readonly categories: readonly CategoryView[];
  /** Pessoas ativas do espaço (o seletor "Quem pagou" só aparece com 2 ou mais). */
  readonly members: readonly MemberOption[];
  /** Membro da pessoa logada neste espaço. */
  readonly currentMemberId: string;
  readonly memories: readonly DescriptionMemory[];
  readonly paymentMethods: readonly string[];
}

export interface BudgetLine {
  readonly categoryId: string;
  /** Limite mensal. */
  readonly monthlyLimit: Cents;
}

export interface GoalView {
  readonly id: string;
  readonly name: string;
  readonly icon: string;
  readonly target: Cents;
  /** Soma dos depósitos cujo lançamento "Guardado" não foi excluído. */
  readonly saved: Cents;
  readonly monthly: Cents;
}

/** Resultado da busca em todos os meses. */
export type TxSearchHit = TxView;
