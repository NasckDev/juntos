"use client";

import { forecastMonth, formatBRL, goalProgress, monthShort } from "@juntos/core";
import { Pencil, Plus } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { IconButton } from "@/components/ui/icon-button";
import { Progress } from "@/components/ui/progress";
import type { GoalsData } from "@/server/planning-loaders";
import type { GoalView } from "@/server/services/finance-types";
import { categoryIconOf } from "../financas/category-icon";
import { useFinanceUi } from "../financas/finance-context";
import { DepositSheet } from "./deposit-sheet";
import { GoalCelebration, TrophyArt } from "./goal-celebration";
import { GoalFormSheet } from "./goal-form-sheet";
import { ViewerNote } from "./viewer-note";

type Sheet =
  | { readonly type: "form"; readonly goal?: GoalView }
  | { readonly type: "deposit"; readonly goal: GoalView }
  | null;

/** Botão "Nova meta" do cabeçalho (quem só vê não o recebe). */
export function NewGoalButton({ label = "Nova meta" }: { label?: string }) {
  const { canEdit, form } = useFinanceUi();
  const [open, setOpen] = useState(false);
  if (!canEdit) return null;
  return (
    <>
      <Button icon={<Plus />} onClick={() => setOpen(true)}>
        {label}
      </Button>
      {open ? <GoalFormSheet open onOpenChange={setOpen} spaceId={form.spaceId} /> : null}
    </>
  );
}

/** Metas (`pMetas` do protótipo): cartões com progresso, valor por mês, previsão e "Guardar nesta meta". */
export function GoalsView({ data }: { data: GoalsData }) {
  const { canEdit, form } = useFinanceUi();
  const [sheet, setSheet] = useState<Sheet>(null);
  const [celebrate, setCelebrate] = useState<GoalView | null>(null);

  if (data.goals.length === 0) {
    return (
      <>
        {canEdit ? null : <ViewerNote />}
        <Card>
          <EmptyState
            art="goal"
            title="Nenhuma meta neste espaço"
            description="Uma meta mostra quanto falta e em que mês vocês chegam lá."
            action={canEdit ? <NewGoalButton label="Criar meta" /> : null}
          />
        </Card>
      </>
    );
  }

  return (
    <>
      {canEdit ? null : <ViewerNote />}
      <ul className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 lg:gap-6">
        {data.goals.map((goal) => (
          <li key={goal.id} className="min-w-0">
            <GoalCard
              goal={goal}
              today={data.today}
              canEdit={canEdit}
              onEdit={() => setSheet({ type: "form", goal })}
              onDeposit={() => setSheet({ type: "deposit", goal })}
            />
          </li>
        ))}
      </ul>
      {sheet?.type === "form" && sheet.goal ? (
        <GoalFormSheet
          key={sheet.goal.id}
          open
          onOpenChange={(open) => (open ? undefined : setSheet(null))}
          spaceId={form.spaceId}
          goal={sheet.goal}
        />
      ) : null}
      {sheet?.type === "deposit" ? (
        <DepositSheet
          key={sheet.goal.id}
          open
          onOpenChange={(open) => (open ? undefined : setSheet(null))}
          spaceId={form.spaceId}
          goal={sheet.goal}
          today={data.today}
          onReached={setCelebrate}
        />
      ) : null}
      <GoalCelebration goal={celebrate} onClose={() => setCelebrate(null)} />
    </>
  );
}

interface GoalCardProps {
  readonly goal: GoalView;
  readonly today: string;
  readonly canEdit: boolean;
  readonly onEdit: () => void;
  readonly onDeposit: () => void;
}

function GoalCard({ goal, today, canEdit, onEdit, onDeposit }: GoalCardProps) {
  const progress = goalProgress({ ...goal, monthly: goal.monthly });
  const Icon = categoryIconOf(goal.icon);
  const forecast = forecastMonth({ ...goal }, today);
  const titleId = `meta-${goal.id}`;
  return (
    <Card aria-labelledby={titleId} className="flex h-full flex-col">
      <div className="mb-4 flex items-center gap-3">
        <span
          aria-hidden="true"
          className="grid size-9 shrink-0 place-items-center rounded-[0.6rem] bg-brand-soft text-brand-text [&_svg]:size-[1.125rem]"
        >
          <Icon />
        </span>
        <div className="min-w-0 flex-1">
          <h3 id={titleId} className="truncate font-semibold">
            {goal.name}
          </h3>
          <p className="text-sm text-muted">
            {progress.reached ? "Meta alcançada" : `Faltam ${formatBRL(progress.left)}`}
          </p>
        </div>
        {canEdit ? <IconButton label={`Editar meta ${goal.name}`} icon={<Pencil />} onClick={onEdit} /> : null}
      </div>
      <p className="text-2xl font-[650] tracking-[-0.03em]">
        <span className="hv num">{formatBRL(goal.saved)}</span>{" "}
        <span className="text-sm font-medium tracking-normal text-muted">
          de <span className="hv num">{formatBRL(goal.target)}</span>
        </span>
      </p>
      <Progress
        className="mt-2"
        value={goal.saved}
        max={goal.target}
        tone={progress.reached ? "in" : "brand"}
        label={`${goal.name}, ${progress.percent}% guardado`}
      />
      <dl className="mt-4 grid grid-cols-3 gap-2 text-sm">
        <div className="min-w-0">
          <dt className="text-muted">Progresso</dt>
          <dd className="num font-semibold">{progress.percent}%</dd>
        </div>
        <div className="min-w-0">
          <dt className="text-muted">Por mês</dt>
          <dd className="hv num truncate font-semibold">{goal.monthly > 0 ? formatBRL(goal.monthly) : "Livre"}</dd>
        </div>
        <div className="min-w-0">
          <dt className="text-muted">Previsão</dt>
          <dd className="font-semibold">
            {progress.reached ? "Concluída" : forecast ? monthShort(forecast) : "Sem data"}
          </dd>
        </div>
      </dl>
      <div className="mt-auto pt-5">
        {progress.reached ? (
          <p className="flex items-center gap-2 font-semibold text-in">
            <TrophyArt className="size-10" />
            Meta concluída
          </p>
        ) : canEdit ? (
          <Button variant="line" block icon={<Plus />} onClick={onDeposit}>
            Guardar nesta meta
          </Button>
        ) : null}
      </div>
    </Card>
  );
}
