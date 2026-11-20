import * as z from "zod";
import { idSchema } from "./common";

/** Tipos de meta (ícones) do protótipo (`goalForm`). */
export const GOAL_ICONS = [
  { value: "alvo", label: "Geral" },
  { value: "casa", label: "Casa" },
  { value: "carro", label: "Carro" },
  { value: "viagem", label: "Viagem" },
  { value: "reserva", label: "Reserva" },
  { value: "estudo", label: "Estudo" },
  { value: "presente", label: "Presente" },
  { value: "saude", label: "Saúde" },
] as const;
const GOAL_ICON_KEYS = GOAL_ICONS.map((icon) => icon.value) as [string, ...string[]];

export const GOAL_NAME_MAX = 40;
/** Meta máxima: R$ 1 bilhão (o protótipo recusa acima de 1e9 reais). */
export const MAX_GOAL_CENTS = 100_000_000_000;

export const GOAL_MESSAGES = {
  name: "Dê um nome para a meta, como “viagem de férias”.",
  nameLong: `Use no máximo ${GOAL_NAME_MAX} caracteres no nome.`,
  nameTaken: "Já existe uma meta com esse nome neste espaço.",
  icon: "Escolha o tipo da meta.",
  target: "Digite quanto precisa juntar, maior que zero.",
  tooHigh: "Valor muito alto. Confira os zeros.",
  savedInvalid: "Valor inválido. Use números, como 1.500,00.",
  savedOverTarget: "O valor guardado passa da meta. Ajuste um dos dois.",
  monthlyInvalid: "Valor inválido. Use números, como 300,00.",
  monthlyOverTarget: "O valor por mês passa do total da meta.",
  depositAmount: "Digite um valor maior que zero.",
  notFound: "Não encontramos essa meta. Ela pode ter sido excluída.",
} as const;

const cents = (message: string) => z.number({ error: message }).int({ error: message });

const fields = {
  spaceId: idSchema,
  name: z
    .string({ error: GOAL_MESSAGES.name })
    .trim()
    .min(2, { error: GOAL_MESSAGES.name })
    .max(GOAL_NAME_MAX, { error: GOAL_MESSAGES.nameLong }),
  icon: z.enum(GOAL_ICON_KEYS, { error: GOAL_MESSAGES.icon }),
  target: cents(GOAL_MESSAGES.target)
    .positive({ error: GOAL_MESSAGES.target })
    .max(MAX_GOAL_CENTS, { error: GOAL_MESSAGES.tooHigh }),
  /** Guardar por mês; 0 = livre. */
  monthly: cents(GOAL_MESSAGES.monthlyInvalid).min(0, { error: GOAL_MESSAGES.monthlyInvalid }),
};

function checkMonthly(value: { target: number; monthly: number }, ctx: z.RefinementCtx): void {
  if (value.monthly > value.target) {
    ctx.addIssue({ code: "custom", path: ["monthly"], message: GOAL_MESSAGES.monthlyOverTarget });
  }
}

/** Meta nova; o "já guardado" vira um depósito (lançamento Guardado) na mesma transação. */
export const createGoalSchema = z
  .object({ ...fields, saved: cents(GOAL_MESSAGES.savedInvalid).min(0, { error: GOAL_MESSAGES.savedInvalid }) })
  .superRefine((value, ctx) => {
    if (value.saved > value.target) {
      ctx.addIssue({ code: "custom", path: ["saved"], message: GOAL_MESSAGES.savedOverTarget });
    }
    checkMonthly(value, ctx);
  });
export type CreateGoalInput = z.input<typeof createGoalSchema>;
export type CreateGoalData = z.output<typeof createGoalSchema>;

export const updateGoalSchema = z.object({ ...fields, id: idSchema }).superRefine(checkMonthly);
export type UpdateGoalInput = z.input<typeof updateGoalSchema>;
export type UpdateGoalData = z.output<typeof updateGoalSchema>;

export const goalRefSchema = z.object({ spaceId: idSchema, id: idSchema });
export type GoalRefInput = z.input<typeof goalRefSchema>;

export const depositSchema = z.object({
  spaceId: idSchema,
  goalId: idSchema,
  amount: cents(GOAL_MESSAGES.depositAmount).positive({ error: GOAL_MESSAGES.depositAmount }),
});
export type DepositInput = z.input<typeof depositSchema>;
