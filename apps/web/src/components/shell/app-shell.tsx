"use client";

import { Bell, ChevronsUpDown, Eye, EyeOff, Plus, Search } from "lucide-react";
import Link from "next/link";
import { type ReactNode, useEffect, useState, useSyncExternalStore } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { CountBadge } from "@/components/ui/count-badge";
import { IconButton, iconButtonLabel } from "@/components/ui/icon-button";
import { Kbd } from "@/components/ui/kbd";
import { cn } from "@/lib/cn";
import { LogoMark } from "./logo";
import { MAIN_NAV, type NavItem, type NavKey, SECONDARY_NAV } from "./nav";

export interface ShellUser {
  name: string;
  /** Chave do avatar desenhado ou `null` para a inicial. */
  avatar?: string | null;
  /** Conta de convidado (mostra "Convidado" no rodapé). */
  isGuest?: boolean;
}

export interface ShellSpace {
  id: string;
  name: string;
  memberCount: number;
}

export interface AppShellProps {
  user: ShellUser;
  /** Espaço atual (Casa, Só meu, Viagem…). */
  space: ShellSpace;
  /** Rota ativa, para marcar o item da navegação. */
  active: NavKey;
  /** Avisos não lidos (contador no sino e em Notificações). */
  unreadCount: number;
  /** "Esconder valores" ligado. */
  hideValues: boolean;
  onToggleHideValues: () => void;
  /** Abre o formulário de novo lançamento (botão, botão flutuante e atalho N). */
  onNewEntry: () => void;
  /** Abre a busca (a paleta de comandos fica com a tela). */
  onSearch: () => void;
  /** Abre a troca de espaço. */
  onOpenSpaces: () => void;
  children: ReactNode;
}

const subscribeNoop = () => () => {};
const isMac = () => /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

/** Atalho N para novo lançamento, como no protótipo. */
function useNewEntryShortcut(onNewEntry: () => void) {
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key.toLowerCase() !== "n" || event.metaKey || event.ctrlKey || event.altKey) return;
      if (isTyping(event.target) || document.querySelector("[role=dialog]")) return;
      event.preventDefault();
      onNewEntry();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onNewEntry]);
}

/** Esconde o botão flutuante ao rolar para baixo e mostra de novo ao subir. */
function useHideOnScroll(): boolean {
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    let last = window.scrollY;
    function onScroll() {
      const y = window.scrollY;
      if (Math.abs(y - last) < 8) return;
      setHidden(y > last && y > 80);
      last = y;
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return hidden;
}

function spaceSubtitle(count: number): string {
  return count > 1 ? `${count} pessoas` : "Só você";
}

/** Casca do app: barra lateral no computador; topo com vidro, barra inferior e botão flutuante no celular. */
export function AppShell({
  user,
  space,
  active,
  unreadCount,
  hideValues,
  onToggleHideValues,
  onNewEntry,
  onSearch,
  onOpenSpaces,
  children,
}: AppShellProps) {
  useNewEntryShortcut(onNewEntry);
  const fabHidden = useHideOnScroll();
  const mac = useSyncExternalStore(subscribeNoop, isMac, () => false);
  const hideLabel = hideValues ? "Mostrar valores" : "Esconder valores";
  const HideIcon = hideValues ? EyeOff : Eye;

  return (
    <>
      <a
        href="#conteudo"
        className="sr-only-focusable fixed top-2 left-2 z-[70] rounded-field bg-ink px-4 py-2.5 font-semibold text-surface"
      >
        Pular para o conteúdo
      </a>
      <div className="min-h-dvh lg:grid lg:grid-cols-[16.5rem_minmax(0,1fr)]">
        {/* Computador: barra lateral */}
        <aside className="sticky top-0 hidden h-dvh flex-col gap-1 overflow-y-auto border-r border-line bg-side px-3 py-4 lg:flex">
          <Link
            href="/inicio"
            className="mb-4 flex items-center gap-2.5 rounded-field px-2 py-1 text-lg font-bold tracking-[-0.02em]"
          >
            <LogoMark />
            Juntos
          </Link>
          <button
            type="button"
            onClick={onOpenSpaces}
            aria-label={`Trocar de espaço. Atual: ${space.name}`}
            className="mb-3 flex w-full items-center gap-3 rounded-[0.75rem] border border-line bg-surface p-2 text-left transition-colors hover:border-line2"
          >
            <SpaceSquare name={space.name} />
            <span className="min-w-0 flex-1">
              <b className="block truncate font-semibold">{space.name}</b>
              <small className="block text-xs text-muted">{spaceSubtitle(space.memberCount)}</small>
            </span>
            <ChevronsUpDown aria-hidden="true" className="size-4 text-muted" />
          </button>
          <Button
            icon={<Plus />}
            onClick={onNewEntry}
            aria-keyshortcuts="N"
            title="Novo lançamento (atalho: N)"
            className="mb-2 w-full"
          >
            Novo lançamento
          </Button>
          <button
            type="button"
            onClick={onSearch}
            aria-keyshortcuts={mac ? "Meta+K" : "Control+K"}
            className="mb-3 flex h-10 w-full items-center gap-3 rounded-field px-3 text-muted transition-colors hover:bg-surface3 hover:text-ink"
          >
            <Search aria-hidden="true" className="size-[1.125rem]" />
            <span className="flex-1 text-left">Buscar</span>
            <Kbd>{mac ? "⌘K" : "Ctrl K"}</Kbd>
          </button>
          <nav aria-label="Principal" className="flex flex-col gap-0.5">
            {MAIN_NAV.map((item) => (
              <SideLink key={item.key} item={item} active={active === item.key} />
            ))}
          </nav>
          <div className="flex-1" />
          <nav aria-label="Conta e dados" className="flex flex-col gap-0.5">
            {SECONDARY_NAV.map((item) => (
              <SideLink
                key={item.key}
                item={item}
                active={active === item.key}
                count={item.key === "notificacoes" ? unreadCount : 0}
              />
            ))}
          </nav>
          <div className="mt-3 flex items-center gap-1 border-t border-line pt-3">
            <Link
              href="/ajustes"
              className="flex min-w-0 flex-1 items-center gap-2.5 rounded-field p-1.5 transition-colors hover:bg-surface3"
            >
              <Avatar name={user.name} avatar={user.avatar} size="md" decorative />
              <span className="min-w-0">
                <b className="block truncate text-sm font-semibold">{user.name}</b>
                <small className="block text-xs text-muted">{user.isGuest ? "Convidado" : "Minha conta"}</small>
              </span>
            </Link>
            <IconButton label={hideLabel} icon={<HideIcon />} aria-pressed={hideValues} onClick={onToggleHideValues} />
            <BellLink count={unreadCount} />
          </div>
        </aside>

        {/* Celular: topo fixo com vidro */}
        <header className="glass pt-safe sticky top-0 z-30 border-b border-line lg:hidden">
          <div className="flex h-14 items-center gap-1 px-2">
            <button
              type="button"
              onClick={onOpenSpaces}
              aria-label={`Trocar de espaço. Atual: ${space.name}`}
              className="flex h-11 min-w-0 items-center gap-2 rounded-field px-2 hover:bg-surface3"
            >
              <SpaceSquare name={space.name} />
              <b className="truncate text-lg font-semibold">{space.name}</b>
              <ChevronsUpDown aria-hidden="true" className="size-4 shrink-0 text-muted" />
            </button>
            <span className="flex-1" />
            <IconButton label="Buscar" icon={<Search />} onClick={onSearch} />
            <IconButton label={hideLabel} icon={<HideIcon />} aria-pressed={hideValues} onClick={onToggleHideValues} />
            <BellLink count={unreadCount} />
            <Link
              href="/ajustes"
              aria-label="Ajustes e conta"
              className="hit ml-1 grid size-11 place-items-center rounded-full"
            >
              <Avatar name={user.name} avatar={user.avatar} size="md" decorative />
            </Link>
          </div>
        </header>

        <main id="conteudo" tabIndex={-1} className="min-w-0 outline-none">
          <div className="mx-auto w-full max-w-[75rem] px-4 pt-5 pb-[calc(7rem+env(safe-area-inset-bottom,0px))] sm:px-6 lg:px-10 lg:pt-9 lg:pb-14">
            {children}
          </div>
        </main>
      </div>

      {/* Celular: botão flutuante e barra inferior */}
      <button
        type="button"
        onClick={onNewEntry}
        aria-label="Novo lançamento"
        tabIndex={fabHidden ? -1 : 0}
        className={cn(
          "fixed right-4 bottom-[calc(4.75rem+env(safe-area-inset-bottom,0px))] z-30 grid size-14 place-items-center rounded-[1.1rem] bg-brand text-brand-ink shadow-[0_10px_24px_-6px_hsl(var(--h)_60%_40%/.55)] transition-[transform,opacity] duration-200 lg:hidden",
          fabHidden && "pointer-events-none translate-y-24 opacity-0",
        )}
      >
        <Plus aria-hidden="true" className="size-6" />
      </button>
      <nav
        aria-label="Principal"
        className="glass pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-line lg:hidden"
      >
        <ul className="mx-auto flex max-w-lg">
          {MAIN_NAV.map((item) => {
            const isActive = active === item.key;
            return (
              <li key={item.key} className="min-w-0 flex-1">
                <Link
                  href={item.href}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "flex h-16 flex-col items-center justify-center gap-1 px-0.5 text-[0.6875rem] font-medium tracking-[-0.01em] text-muted",
                    isActive && "font-semibold text-brand-text",
                  )}
                >
                  <item.icon aria-hidden="true" className={cn("size-6", isActive && "text-brand")} />
                  <span className="max-w-full truncate">{item.short}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}

function SpaceSquare({ name }: { name: string }) {
  return (
    <span
      aria-hidden="true"
      className="grid size-8 shrink-0 place-items-center rounded-[0.5rem] bg-brand-soft text-sm font-bold text-brand-text"
    >
      {name.trim().charAt(0).toUpperCase() || "?"}
    </span>
  );
}

function SideLink({ item, active, count = 0 }: { item: NavItem; active: boolean; count?: number }) {
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      aria-label={count > 0 ? iconButtonLabel(item.label, count) : undefined}
      className={cn(
        "flex h-10 items-center gap-3 rounded-field px-3 font-medium text-muted transition-colors",
        "hover:bg-surface3 hover:text-ink",
        active && "bg-brand-soft font-semibold text-brand-text hover:bg-brand-soft hover:text-brand-text",
      )}
    >
      <item.icon aria-hidden="true" className={cn("size-[1.125rem] shrink-0", active && "text-brand")} />
      <span className="min-w-0 flex-1 truncate">{item.label}</span>
      <CountBadge count={count} />
    </Link>
  );
}

function BellLink({ count }: { count: number }) {
  return (
    <Link
      href="/notificacoes"
      aria-label={iconButtonLabel("Notificações", count)}
      title="Notificações"
      className="hit relative grid size-11 shrink-0 place-items-center rounded-field text-muted transition-colors hover:bg-surface3 hover:text-ink lg:size-9"
    >
      <Bell aria-hidden="true" className="size-5" />
      <CountBadge count={count} placement="dot" />
    </Link>
  );
}
