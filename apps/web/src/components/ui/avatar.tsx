"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import { AVATAR_GROUPS, AvatarArt, type AvatarKey, avatarName, isAvatarKey } from "./avatar-art";
import { Button } from "./button";

export type { AvatarKey } from "./avatar-art";

/** Primeira letra do nome, maiúscula (`ini` do protótipo). */
export function initialOf(name: string): string {
  return name.trim().charAt(0).toUpperCase() || "?";
}

const SIZE = {
  xs: "size-6 text-micro",
  sm: "size-8 text-xs",
  md: "size-9 text-sm",
  lg: "size-12 text-lg",
  xl: "size-16 text-2xl",
} as const;

export interface AvatarProps {
  name: string;
  /** Chave do avatar desenhado ("a1", "b3", "c2"). Sem ela, mostra a inicial. */
  avatar?: string | null | undefined;
  size?: keyof typeof SIZE;
  /** Com `true`, o avatar é só enfeite (o nome já está escrito ao lado). */
  decorative?: boolean;
  className?: string;
}

export function Avatar({ name, avatar, size = "md", decorative = false, className }: AvatarProps) {
  const a11y = decorative ? { "aria-hidden": true as const } : { role: "img" as const, "aria-label": name };
  return (
    <span
      {...a11y}
      className={cn(
        "inline-grid shrink-0 place-items-center overflow-hidden rounded-full bg-brand font-bold text-brand-ink select-none",
        SIZE[size],
        className,
      )}
    >
      {isAvatarKey(avatar) ? <AvatarArt id={avatar} className="size-full" /> : initialOf(name)}
    </span>
  );
}

export interface AvatarPickerProps {
  /** Nome da pessoa (para a opção de iniciais). */
  name: string;
  /** Avatar escolhido; `null` = iniciais. */
  value: AvatarKey | null;
  onValueChange: (value: AvatarKey | null) => void;
}

const optionClass = cn(
  "hit grid size-13 place-items-center overflow-hidden rounded-full shadow-[0_0_0_1px_var(--line2)] transition-shadow",
  "aria-pressed:shadow-[0_0_0_2px_var(--surface),0_0_0_4px_var(--brand)]",
);

/** Escolha do avatar (`avPicker` do protótipo): 8 pessoas à vista e "Ver mais" com pessoas, animais e objetos. */
export function AvatarPicker({ name, value, onValueChange }: AvatarPickerProps) {
  const [showAll, setShowAll] = useState(false);
  const groups = showAll ? AVATAR_GROUPS : [{ label: "", keys: AVATAR_GROUPS[0]?.keys.slice(0, 8) ?? [] }];

  return (
    <div>
      {groups.map((group) => (
        <div key={group.label || "inicio"} className="mt-3 first:mt-0">
          {group.label ? <p className="mb-2 text-xs font-semibold text-muted">{group.label}</p> : null}
          <div className="flex flex-wrap gap-2.5">
            {group.keys.map((key) => (
              <button
                key={key}
                type="button"
                aria-pressed={value === key}
                aria-label={avatarName(key)}
                title={key.startsWith("a") ? undefined : avatarName(key)}
                onClick={() => onValueChange(key)}
                className={optionClass}
              >
                <AvatarArt id={key} className="size-full" />
              </button>
            ))}
            {!group.label || group.label === "Pessoas" ? (
              <button
                type="button"
                aria-pressed={value === null}
                aria-label="Usar as iniciais"
                title="Iniciais"
                onClick={() => onValueChange(null)}
                className={cn(optionClass, "bg-brand text-lg font-bold text-brand-ink")}
              >
                {initialOf(name)}
              </button>
            ) : null}
          </div>
        </div>
      ))}
      <Button
        variant="link"
        size="sm"
        className="mt-3"
        aria-expanded={showAll}
        onClick={() => setShowAll((open) => !open)}
      >
        {showAll ? "Ver menos" : "Ver mais"}
      </Button>
    </div>
  );
}
