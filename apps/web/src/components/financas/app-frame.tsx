"use client";

import { type YearMonth, ymAdd } from "@juntos/core";
import { usePathname, useRouter } from "next/navigation";
import { type ReactNode, useEffect, useState } from "react";
import { WelcomeSheet } from "@/components/boas-vindas/welcome-sheet";
import { SpacesSheet, type SpacesSheetSpace } from "@/components/espacos/spaces-sheet";
import { AppShell } from "@/components/shell/app-shell";
import { MAIN_NAV, type NavKey, SECONDARY_NAV } from "@/components/shell/nav";
import { periodMonthsOf } from "@/lib/finance";
import { applyPreferences, toAppearance } from "@/lib/preferences";
import { updatePreferences } from "@/server/actions/account";
import type { EntryFormData, RecurrenceView, TxView } from "@/server/services/finance-types";
import type { Preferences } from "@/server/services/preferences";
import { toastError } from "./feedback";
import { FinanceContext, type FinanceUi, type NewEntryOptions } from "./finance-context";
import { RecurrenceFormSheet } from "./recurrence-form";
import { SearchPalette } from "./search-palette";
import { ShortcutsSheet } from "./shortcuts-sheet";
import { type TxFormMode, TxFormSheet } from "./tx-form";
import { usePeriod } from "./use-period";

export interface AppFrameProps {
  readonly user: {
    readonly id: string;
    readonly name: string;
    readonly avatar: string | null;
    readonly isGuest: boolean;
    /** Convidado com o nome padrão: abre a folha de boas-vindas. */
    readonly needsWelcome: boolean;
  };
  readonly spaces: readonly (SpacesSheetSpace & { readonly memberCount: number })[];
  readonly activeSpaceId: string;
  readonly unreadCount: number;
  readonly preferences: Preferences;
  readonly form: EntryFormData;
  readonly children: ReactNode;
}

/** Mesma mensagem do servidor para quem só vê o espaço. */
const VIEWER_MESSAGE = "Você não tem permissão para fazer isso neste espaço.";
/**
 * Telas com mês ou período na URL (`?mes=&meses=`) e seletor de período no cabeçalho: as setas do teclado trocam o
 * mês. No Planejamento o período só vale na aba Orçamento (as outras abas não usam mês, e o simulador tem campos
 * deslizantes), então ele fica de fora, assim como Notificações, Dados e Ajustes, que não têm mês.
 */
const MONTH_PAGES = ["/inicio", "/lancamentos", "/divisao", "/relatorios"];
const NAV_KEYS = new Set<string>([...MAIN_NAV, ...SECONDARY_NAV].map((item) => item.key));

function navKeyOf(pathname: string): NavKey {
  const first = pathname.split("/")[1] ?? "";
  return NAV_KEYS.has(first) ? (first as NavKey) : "inicio";
}

function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

function systemIsDark(): boolean {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

interface Sheet<T> {
  readonly key: number;
  readonly open: boolean;
  readonly value: T;
}

/**
 * Casca do app ligada aos dados: espaço ativo, avisos não vistos, esconder valores, formulário de lançamento
 * em qualquer tela (botão, botão flutuante e atalho N), busca Ctrl/⌘+K e "/", setas (mês) e "?" (atalhos).
 */
export function AppFrame({ user, spaces, activeSpaceId, unreadCount, preferences, form, children }: AppFrameProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { period, setPeriod } = usePeriod(form.today);
  const canEdit = form.role !== "viewer";
  const [hide, setHide] = useState(preferences.hideValues);
  const [theme, setTheme] = useState(preferences.theme);
  const [txSheet, setTxSheet] = useState<Sheet<TxFormMode> | null>(null);
  const [recSheet, setRecSheet] = useState<Sheet<RecurrenceView> | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [spacesOpen, setSpacesOpen] = useState(false);
  const [isDark, setIsDark] = useState(false);
  const onMonthPage = MONTH_PAGES.some((page) => pathname === page || pathname.startsWith(`${page}/`));

  // Aplica as preferências do servidor e espelha no localStorage (a próxima visita abre sem piscar).
  useEffect(() => {
    setHide(preferences.hideValues);
    setTheme(preferences.theme);
    applyPreferences(toAppearance(preferences));
  }, [preferences]);

  useEffect(() => {
    setIsDark(theme === "dark" || (theme === "auto" && systemIsDark()));
  }, [theme]);

  function openTx(value: TxFormMode) {
    setTxSheet((current) => ({ key: (current?.key ?? 0) + 1, open: true, value }));
  }

  const ui: FinanceUi = {
    form,
    canEdit,
    openNewEntry: (options: NewEntryOptions = {}) => {
      if (!canEdit) return toastError(VIEWER_MESSAGE);
      openTx({ type: "new", options });
    },
    openEditEntry: (tx: TxView) => openTx({ type: "edit", tx }),
    openRecurrence: (value: RecurrenceView) =>
      setRecSheet((current) => ({ key: (current?.key ?? 0) + 1, open: true, value })),
  };

  // Setas trocam o mês (Início e Lançamentos); "?" mostra os atalhos.
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.ctrlKey || event.metaKey || event.altKey || isTyping(event.target)) return;
      if (document.querySelector("[role=dialog],[role=alertdialog]")) return;
      if (event.key === "?") {
        event.preventDefault();
        setShortcutsOpen(true);
        return;
      }
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      if (!onMonthPage) return;
      const target = event.target instanceof HTMLElement ? event.target : null;
      if (target?.closest("[role=tablist],[role=radiogroup],[role=slider],[role=grid]")) return;
      event.preventDefault();
      setPeriod({ start: ymAdd(period.start, event.key === "ArrowLeft" ? -1 : 1), span: period.span });
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onMonthPage, period.start, period.span, setPeriod]);

  function persist(patch: Parameters<typeof updatePreferences>[0], rollback: () => void) {
    void updatePreferences(patch).then(
      (result) => {
        if (!result.ok) {
          rollback();
          toastError(result.error);
        }
      },
      () => rollback(),
    );
  }

  function toggleHide() {
    const next = !hide;
    setHide(next);
    applyPreferences(toAppearance({ ...preferences, theme, hideValues: next }));
    persist({ hideValues: next }, () => {
      setHide(!next);
      applyPreferences(toAppearance({ ...preferences, theme, hideValues: !next }));
    });
  }

  function toggleTheme() {
    const previous = theme;
    const next = isDark ? "light" : "dark";
    setTheme(next);
    applyPreferences(toAppearance({ ...preferences, theme: next, hideValues: hide }));
    persist({ theme: next }, () => {
      setTheme(previous);
      applyPreferences(toAppearance({ ...preferences, theme: previous, hideValues: hide }));
    });
  }

  /** Depois de salvar, a tela vai para o mês do lançamento se ele estiver fora do período (como no protótipo). */
  function afterSave(competence: YearMonth) {
    if (onMonthPage && !periodMonthsOf(period).includes(competence))
      setPeriod({ start: competence, span: period.span });
  }

  function openFromSearch(tx: TxView) {
    router.push(`/lancamentos?mes=${tx.competence}`);
    openTx({ type: "edit", tx });
  }

  const activeSpace = spaces.find((space) => space.id === activeSpaceId) ?? spaces[0];

  return (
    <FinanceContext value={ui}>
      <AppShell
        user={{ name: user.name, avatar: user.avatar, isGuest: user.isGuest }}
        space={{ id: activeSpaceId, name: activeSpace?.name ?? "", memberCount: activeSpace?.memberCount ?? 1 }}
        active={navKeyOf(pathname)}
        unreadCount={unreadCount}
        hideValues={hide}
        onToggleHideValues={toggleHide}
        onNewEntry={() => ui.openNewEntry()}
        onSearch={() => setPaletteOpen(true)}
        onOpenSpaces={() => setSpacesOpen(true)}
      >
        {children}
      </AppShell>
      {txSheet ? (
        <TxFormSheet
          key={txSheet.key}
          open={txSheet.open}
          mode={txSheet.value}
          data={form}
          canEdit={canEdit}
          viewYm={period.start}
          onOpenChange={(open) => setTxSheet((current) => (current ? { ...current, open } : current))}
          onSaved={afterSave}
        />
      ) : null}
      {recSheet ? (
        <RecurrenceFormSheet
          key={recSheet.key}
          open={recSheet.open}
          recurrence={recSheet.value}
          data={form}
          canEdit={canEdit}
          onOpenChange={(open) => setRecSheet((current) => (current ? { ...current, open } : current))}
        />
      ) : null}
      <SearchPalette
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        form={form}
        hideValues={hide}
        isDark={isDark}
        onNewEntry={(kind) => ui.openNewEntry(kind ? { kind } : {})}
        onToggleHide={toggleHide}
        onToggleTheme={toggleTheme}
        onOpenTransaction={openFromSearch}
      />
      <ShortcutsSheet open={shortcutsOpen} onOpenChange={setShortcutsOpen} />
      <SpacesSheet open={spacesOpen} onOpenChange={setSpacesOpen} spaces={spaces} activeSpaceId={activeSpaceId} />
      <WelcomeSheet userId={user.id} needsName={user.needsWelcome} />
    </FinanceContext>
  );
}
