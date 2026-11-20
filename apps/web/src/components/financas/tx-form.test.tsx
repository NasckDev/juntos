import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { EntryFormData } from "@/server/services/finance-types";

const actions = vi.hoisted(() => ({
  createTransaction: vi.fn(),
  updateTransaction: vi.fn(),
  deleteTransaction: vi.fn(),
  duplicateTransaction: vi.fn(),
  discardCreatedTransaction: vi.fn(),
}));
vi.mock("@/server/actions/transactions", () => actions);
vi.mock("@/server/actions/undo", () => ({ undo: vi.fn() }));

const { TxFormSheet } = await import("./tx-form");
const { TX_MESSAGES } = await import("@/server/validators/transactions");

const SPACE = "11111111-1111-4111-8111-111111111111";
const ME = "22222222-2222-4222-8222-222222222222";
const CONTAS = "33333333-3333-4333-8333-333333333333";
const OUTROS = "44444444-4444-4444-8444-444444444444";
const SALARIO = "55555555-5555-4555-8555-555555555555";

const data: EntryFormData = {
  spaceId: SPACE,
  role: "owner",
  today: "2026-11-20",
  categories: [
    { id: CONTAS, key: "contas", name: "Contas da casa", icon: "contas", hue: 42, kind: "out" },
    { id: OUTROS, key: "outros", name: "Outros", icon: "caixa", hue: 222, kind: "out" },
    { id: SALARIO, key: "salario", name: "Salário", icon: "trabalho", hue: 160, kind: "in" },
  ],
  members: [{ id: ME, name: "Rafa", avatar: null, isYou: true }],
  currentMemberId: ME,
  memories: [],
  paymentMethods: [],
};

function renderForm(onSaved = vi.fn()) {
  render(
    <TxFormSheet
      open
      mode={{ type: "new", options: {} }}
      data={data}
      canEdit
      viewYm="2026-11"
      onOpenChange={vi.fn()}
      onSaved={onSaved}
    />,
  );
  return { onSaved };
}

beforeEach(() => {
  for (const fn of Object.values(actions)) fn.mockReset();
});

describe("formulário de lançamento", () => {
  it("mostra os erros embaixo de cada campo, sem chamar o servidor", async () => {
    const user = userEvent.setup();
    renderForm();
    await user.click(screen.getByRole("button", { name: "Salvar" }));

    const amount = screen.getByLabelText("Valor");
    expect(amount).toHaveAttribute("aria-invalid", "true");
    expect(amount).toHaveAccessibleDescription(TX_MESSAGES.amount);
    expect(screen.getByLabelText("Descrição")).toHaveAccessibleDescription(TX_MESSAGES.descriptionEmpty);
    expect(actions.createTransaction).not.toHaveBeenCalled();

    await user.type(screen.getByLabelText("Valor"), "120,50");
    expect(screen.getByLabelText("Valor")).not.toHaveAttribute("aria-invalid");
  });

  it("sugere a categoria pelo nome e envia o valor em centavos", async () => {
    const user = userEvent.setup();
    actions.createTransaction.mockResolvedValue({
      ok: true,
      data: { id: "t1", recurrenceId: null, competence: "2026-11" },
    });
    const { onSaved } = renderForm();
    await user.type(screen.getByLabelText("Valor"), "120,50");
    await user.type(screen.getByLabelText("Descrição"), "Conta de luz");
    expect(screen.getByLabelText("Categoria")).toHaveValue(CONTAS);
    await user.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() => expect(onSaved).toHaveBeenCalledWith("2026-11"));
    expect(actions.createTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        spaceId: SPACE,
        kind: "out",
        amount: 12_050,
        description: "Conta de luz",
        date: "2026-11-20",
        categoryId: CONTAS,
        paidBy: ME,
        paid: true,
        repeat: "none",
        confirmDuplicate: false,
      }),
    );
  });

  it("avisa do lançamento igual e confirma ao salvar de novo", async () => {
    const user = userEvent.setup();
    actions.createTransaction
      .mockResolvedValueOnce({
        ok: false,
        error: TX_MESSAGES.duplicate,
        fieldErrors: { description: TX_MESSAGES.duplicate },
      })
      .mockResolvedValueOnce({ ok: true, data: { id: "t2", recurrenceId: null, competence: "2026-11" } });
    renderForm();
    await user.type(screen.getByLabelText("Valor"), "86");
    await user.type(screen.getByLabelText("Descrição"), "MEI");
    await user.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() => expect(screen.getByLabelText("Descrição")).toHaveAccessibleDescription(TX_MESSAGES.duplicate));
    await user.click(await screen.findByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(actions.createTransaction).toHaveBeenCalledTimes(2));
    expect(actions.createTransaction.mock.calls[1]?.[0]).toMatchObject({ confirmDuplicate: true });
  });

  it("valida as parcelas só quando repete todo mês", async () => {
    const user = userEvent.setup();
    render(
      <TxFormSheet
        open
        mode={{ type: "new", options: { kind: "in", repeat: "monthly" } }}
        data={data}
        canEdit
        viewYm="2026-11"
        onOpenChange={vi.fn()}
        onSaved={vi.fn()}
      />,
    );
    await user.type(screen.getByLabelText("Valor"), "7800");
    await user.type(screen.getByLabelText("Descrição"), "Salário");
    await user.type(screen.getByLabelText("Parcelas"), "1");
    await user.click(screen.getByRole("button", { name: "Salvar" }));
    expect(screen.getByLabelText("Parcelas")).toHaveAccessibleDescription(TX_MESSAGES.installments);
    expect(actions.createTransaction).not.toHaveBeenCalled();
  });
});
