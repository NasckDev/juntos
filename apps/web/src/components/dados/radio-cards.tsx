"use client";

import { cn } from "@/lib/cn";

export interface RadioCardsProps<T extends string> {
  readonly legend: string;
  readonly name: string;
  readonly value: T;
  readonly onChange: (value: T) => void;
  readonly options: readonly { readonly value: T; readonly label: string }[];
}

/** Escolha única com opções longas, uma por linha (o `seg` vertical do protótipo). Rádios nativos. */
export function RadioCards<T extends string>({ legend, name, value, onChange, options }: RadioCardsProps<T>) {
  return (
    <fieldset className="min-w-0">
      <legend className="mb-1.5 text-sm font-medium">{legend}</legend>
      <div className="flex flex-col gap-1.5">
        {options.map((option) => (
          <label key={option.value} className="relative block cursor-pointer">
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
              className="peer absolute top-1/2 left-3 size-4 -translate-y-1/2 accent-[var(--brand)]"
            />
            <span
              className={cn(
                "block min-h-11 rounded-field border border-line2 py-2.5 pr-3 pl-9 text-md transition-colors lg:min-h-10 lg:py-2",
                "peer-hover:bg-surface2 peer-checked:border-brand peer-checked:bg-brand-soft peer-checked:font-medium",
              )}
            >
              {option.label}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
