import { type Division, type IsoDate, type Role, todayInSaoPaulo } from "@juntos/core";
import { type Period, periodMonthsOf } from "@/lib/finance";
import { requireMember } from "./access";
import { getDb } from "./db";
import { listCategories } from "./services/categories-read";
import type { CategoryView } from "./services/finance-types";
import { materializeMonths } from "./services/month";
import { computeSpaceDivision, type SettlementView } from "./services/settlements";
import type { SplitConfig } from "./services/split";

/*
 * Leitura da tela Divisão (Server Component). Confere que a pessoa participa do espaço, filtra pelo `space_id`
 * e, como as outras telas, lança antes as contas fixas que faltam nos meses abertos (idempotente).
 */

/** Pessoa do espaço como a tela precisa (sem o id do usuário). */
export interface DivisionMember {
  /** Id do membro, o mesmo de "quem pagou" e dos acertos. */
  readonly id: string;
  readonly name: string;
  readonly avatar: string | null;
  readonly isYou: boolean;
}

export interface DivisionData {
  readonly today: IsoDate;
  readonly period: Period;
  readonly role: Role;
  readonly spaceId: string;
  /** Pessoas ativas, na ordem em que entraram (a mesma para todos). */
  readonly members: readonly DivisionMember[];
  /** Modo e percentual salvos (o modo efetivo está em `division.mode`). */
  readonly config: SplitConfig;
  readonly division: Division;
  readonly settlements: readonly SettlementView[];
  readonly categories: readonly CategoryView[];
}

/** Divisão do espaço no período, com os dados reais (renda do modo proporcional = só entradas recebidas). */
export async function loadDivisionData(spaceId: string, period: Period): Promise<DivisionData> {
  const { user: current, membership } = await requireMember(spaceId, "viewer");
  const db = getDb();
  const today = todayInSaoPaulo();
  await materializeMonths(db, spaceId, periodMonthsOf(period), today);
  const [space, categories] = await Promise.all([
    computeSpaceDivision(db, spaceId, period),
    listCategories(db, spaceId),
  ]);
  return {
    today,
    period,
    role: membership.role,
    spaceId,
    members: space.members.map((member) => ({
      id: member.id,
      name: member.name,
      avatar: member.avatar,
      isYou: member.userId === current.id,
    })),
    config: space.config,
    division: space.division,
    settlements: space.settlements,
    categories,
  };
}
