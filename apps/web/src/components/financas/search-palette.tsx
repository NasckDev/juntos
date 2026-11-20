"use client";

import { formatBRL, monthShort } from "@juntos/core";
import { Download, Eye, EyeOff, Moon, Plus, Sun, Target, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { MAIN_NAV, SECONDARY_NAV } from "@/components/shell/nav";
import { CommandPalette, type CommandPaletteGroup } from "@/components/ui/command-palette";
import { categoryOf, signOf } from "@/lib/finance";
import { searchTransactions } from "@/server/actions/transactions";
import type { EntryFormData, TxView } from "@/server/services/finance-types";
import { SEARCH_MIN } from "@/server/validators/transactions";
import { categoryIconOf } from "./category-icon";

/** Quantos lançamentos a busca mostra (como no protótipo). */
const PALETTE_RESULTS = 8;
const DEBOUNCE_MS = 200;

export interface SearchPaletteProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly form: EntryFormData;
  readonly hideValues: boolean;
  readonly isDark: boolean;
  readonly onNewEntry: (kind?: "in") => void;
  readonly onToggleHide: () => void;
  readonly onToggleTheme: () => void;
  readonly onOpenTransaction: (tx: TxView) => void;
}

/** Busca Ctrl/⌘+K (`palette` do protótipo): ações, páginas e lançamentos de todos os meses. */
export function SearchPalette({
  open,
  onOpenChange,
  form,
  hideValues,
  isDark,
  onNewEntry,
  onToggleHide,
  onToggleTheme,
  onOpenTransaction,
}: SearchPaletteProps) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<readonly TxView[]>([]);
  const [loading, setLoading] = useState(false);
  const query = search.trim();

  useEffect(() => {
    if (!open || query.length < SEARCH_MIN) {
      setResults([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const timer = setTimeout(() => {
      void searchTransactions({ spaceId: form.spaceId, query, limit: PALETTE_RESULTS }).then(
        (result) => {
          if (cancelled) return;
          setLoading(false);
          setResults(result.ok ? result.data : []);
        },
        () => {
          if (!cancelled) setLoading(false);
        },
      );
    }, DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [open, query, form.spaceId]);

  function handleOpenChange(next: boolean) {
    if (!next) setSearch("");
    onOpenChange(next);
  }

  const groups: CommandPaletteGroup[] = [
    {
      heading: "Ações",
      items: [
        { id: "novo", label: "Novo lançamento", icon: <Plus />, shortcut: "N", onSelect: () => onNewEntry() },
        { id: "entrada", label: "Nova entrada", icon: <Plus />, onSelect: () => onNewEntry("in") },
        { id: "meta", label: "Nova meta", icon: <Target />, onSelect: () => router.push("/planejamento?aba=metas") },
        {
          id: "importar",
          label: "Importar planilha do Excel",
          icon: <Upload />,
          onSelect: () => router.push("/dados?aba=importar"),
        },
        {
          id: "exportar",
          label: "Exportar para Excel",
          icon: <Download />,
          onSelect: () => router.push("/dados?aba=exportar"),
        },
        {
          id: "valores",
          label: hideValues ? "Mostrar valores" : "Esconder valores",
          icon: hideValues ? <Eye /> : <EyeOff />,
          onSelect: onToggleHide,
        },
        {
          id: "tema",
          label: isDark ? "Usar tema claro" : "Usar tema escuro",
          icon: isDark ? <Sun /> : <Moon />,
          onSelect: onToggleTheme,
        },
      ],
    },
    {
      heading: "Ir para",
      items: [...MAIN_NAV, ...SECONDARY_NAV].map((item) => ({
        id: `ir-${item.key}`,
        label: item.label,
        icon: <item.icon />,
        onSelect: () => router.push(item.href),
      })),
    },
    {
      heading: "Lançamentos",
      items: [...results]
        .sort((a, b) => b.competence.localeCompare(a.competence) || b.day - a.day)
        .map((tx) => {
          const Icon = categoryIconOf(categoryOf(form.categories, tx.categoryId).icon);
          return {
            id: `tx-${tx.id}`,
            label: tx.description,
            hint: `${monthShort(tx.competence)} · ${signOf(tx.kind) || "− "}${formatBRL(tx.amount)}`,
            icon: <Icon />,
            keywords: [query, tx.note],
            onSelect: () => onOpenTransaction(tx),
          };
        }),
    },
  ];

  return (
    <CommandPalette
      open={open}
      onOpenChange={handleOpenChange}
      groups={groups}
      search={search}
      onSearchChange={setSearch}
      isLoading={loading}
      placeholder="Buscar lançamentos, páginas ou ações"
    />
  );
}
