import { type Cents, formatBRL } from "@juntos/core";
import { cn } from "@/lib/cn";

export type AmountKind = "in" | "out" | "save";

export interface AmountProps {
  cents: Cents;
  /** Com tipo, mostra o sinal ("+ " entrada, "− " saída e guardado) e a cor; a cor nunca vem sozinha. */
  kind?: AmountKind;
  /** `display`: o valor do resumo, com centavos menores. */
  size?: "display" | "lg" | "md";
  className?: string;
}

const KIND_CLASS: Record<AmountKind, string> = { in: "text-in", out: "text-ink", save: "text-save" };
const SIGN: Record<AmountKind, string> = { in: "+ ", out: "− ", save: "− " };

/**
 * Valor em reais com números tabulares. Desfoca com "esconder valores".
 * No tamanho `display`, os centavos ficam menores (",00") para o número inteiro mandar na leitura.
 */
export function Amount({ cents, kind, size = "md", className }: AmountProps) {
  const text = formatBRL(Math.abs(cents));
  const negative = cents < 0 && !kind;
  const sign = kind ? SIGN[kind] : negative ? "− " : "";
  const comma = text.lastIndexOf(",");
  const whole = comma >= 0 ? text.slice(0, comma) : text;
  const fraction = comma >= 0 ? text.slice(comma) : "";

  return (
    <span
      className={cn(
        "hv num whitespace-nowrap",
        size === "display" && "text-display font-bold tracking-[-0.045em] lg:text-[3.5rem]",
        size === "lg" && "text-xl font-[650] tracking-[-0.02em]",
        size === "md" && "font-semibold",
        kind && KIND_CLASS[kind],
        negative && "text-out",
        className,
      )}
    >
      {sign}
      {size === "display" ? (
        <>
          {whole}
          <span className="text-[0.55em] font-semibold tracking-[-0.02em] opacity-80">{fraction}</span>
        </>
      ) : (
        text
      )}
    </span>
  );
}
