import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const actions = vi.hoisted(() => ({ createGoal: vi.fn(), updateGoal: vi.fn(), deleteGoal: vi.fn() }));
vi.mock("@/server/actions/goals", () => actions);
vi.mock("@/server/actions/undo", () => ({ undo: vi.fn() }));

const { GoalFormSheet } = await import("./goal-form-sheet");
const { GOAL_MESSAGES } = await import("@/server/validators/goals");

const SPACE = "11111111-1111-4111-8111-111111111111";

beforeEach(() => {
  for (const fn of Object.values(actions)) fn.mockReset();
});

function renderNew() {
  const onOpenChange = vi.fn();
  render(<GoalFormSheet open onOpenChange={onOpenChange} spaceId={SPACE} />);
  return { onOpenChange };
}

describe("formulário de meta", () => {
  it("mostra os erros do protótipo embaixo dos campos, sem chamar o servidor", async () => {
    const user = userEvent.setup();
    renderNew();
    await user.click(screen.getByRole("button", { name: "Salvar" }));

    expect(screen.getByLabelText("Nome da meta")).toHaveAccessibleDescription(GOAL_MESSAGES.name);
    expect(screen.getByLabelText("Quanto precisa juntar")).toHaveAccessibleDescription(GOAL_MESSAGES.target);
    expect(actions.createGoal).not.toHaveBeenCalled();
  });

  it("recusa guardado maior que a meta, valor mensal maior que a meta e texto que não é número", async () => {
    const user = userEvent.setup();
    renderNew();
    await user.type(screen.getByLabelText("Nome da meta"), "Viagem");
    await user.type(screen.getByLabelText("Quanto precisa juntar"), "1000");
    await user.type(screen.getByLabelText("Já guardado"), "1500");
    await user.type(screen.getByLabelText("Guardar por mês"), "abc");
    await user.click(screen.getByRole("button", { name: "Salvar" }));

    expect(screen.getByLabelText("Já guardado")).toHaveAccessibleDescription(
      expect.stringContaining(GOAL_MESSAGES.savedOverTarget),
    );
    expect(screen.getByLabelText("Guardar por mês")).toHaveAccessibleDescription(GOAL_MESSAGES.monthlyInvalid);
    expect(actions.createGoal).not.toHaveBeenCalled();
  });

  it("envia os valores em centavos e fecha ao salvar", async () => {
    const user = userEvent.setup();
    actions.createGoal.mockResolvedValue({ ok: true, data: { id: "g1", transactionId: null } });
    const { onOpenChange } = renderNew();
    await user.type(screen.getByLabelText("Nome da meta"), "  Viagem de férias ");
    await user.type(screen.getByLabelText("Quanto precisa juntar"), "5.000,50");
    await user.type(screen.getByLabelText("Guardar por mês"), "300");
    await user.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() => expect(actions.createGoal).toHaveBeenCalledTimes(1));
    expect(actions.createGoal).toHaveBeenCalledWith({
      spaceId: SPACE,
      name: "Viagem de férias",
      icon: "alvo",
      target: 500_050,
      saved: 0,
      monthly: 30_000,
    });
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  it("mostra o erro do servidor (nome repetido) no campo do nome", async () => {
    const user = userEvent.setup();
    actions.createGoal.mockResolvedValue({
      ok: false,
      error: GOAL_MESSAGES.nameTaken,
      fieldErrors: { name: GOAL_MESSAGES.nameTaken },
    });
    renderNew();
    await user.type(screen.getByLabelText("Nome da meta"), "Viagem");
    await user.type(screen.getByLabelText("Quanto precisa juntar"), "1000");
    await user.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() =>
      expect(screen.getByLabelText("Nome da meta")).toHaveAccessibleDescription(GOAL_MESSAGES.nameTaken),
    );
  });

  it("na edição mostra o guardado como leitura e oferece excluir", () => {
    render(
      <GoalFormSheet
        open
        onOpenChange={vi.fn()}
        spaceId={SPACE}
        goal={{ id: "g1", name: "Casa", icon: "casa", target: 100_000, saved: 40_000, monthly: 0 }}
      />,
    );
    expect(screen.getByRole("dialog", { name: "Editar meta" })).toBeVisible();
    expect(screen.queryByLabelText("Já guardado")).toBeNull();
    expect(screen.getByText(/R\$\s*400,00/)).toBeVisible();
    expect(screen.getByRole("button", { name: "Excluir" })).toBeVisible();
  });
});
