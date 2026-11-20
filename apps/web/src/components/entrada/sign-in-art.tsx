import { AvatarArt } from "@/components/ui/avatar-art";

/**
 * Arte da tela de entrada no computador: uma ilustração da interface, sem números.
 * Os valores são barras neutras de propósito, para nada parecer dado real.
 */
export function SignInArt() {
  return (
    <figure className="relative flex h-full min-h-[36rem] flex-col overflow-hidden rounded-[1.75rem] bg-hero text-hero-ink">
      <div
        aria-hidden="true"
        className="absolute inset-0 opacity-[0.35] [background-image:radial-gradient(circle_at_1px_1px,var(--hero-line)_1px,transparent_0)] [background-size:22px_22px]"
      />
      <div
        aria-hidden="true"
        className="absolute -top-32 -right-24 size-[28rem] rounded-full bg-[radial-gradient(closest-side,hsl(var(--h)_70%_60%/.35),transparent)]"
      />
      <div aria-hidden="true" className="relative flex flex-1 items-center justify-center p-10">
        <div className="relative w-full max-w-[26rem]">
          {/* Resumo do mês */}
          <div className="rounded-[1.1rem] bg-surface p-5 text-ink shadow-pop">
            <div className="flex items-center gap-2">
              <span className="grid size-7 place-items-center rounded-[0.45rem] bg-brand-soft text-xs font-bold text-brand-text">
                C
              </span>
              <b className="text-sm font-semibold">Casa</b>
              <i className="ml-auto h-2 w-14 rounded-full bg-surface3" />
            </div>
            <p className="mt-4 text-xs text-muted">Deve sobrar até o fim do mês</p>
            <i className="mt-2 block h-7 w-44 rounded-md bg-ink/85" />
            <div className="mt-4 flex h-2.5 gap-0.5 overflow-hidden rounded-full">
              <i className="block flex-[5] bg-flow-paid" />
              <i className="flow-due block flex-[2]" />
              <i className="block flex-[0.6] bg-flow-save" />
              <i className="block flex-[2.4] bg-flow-left" />
            </div>
            <div className="mt-4 grid grid-cols-3 gap-3">
              {["Entrou", "Saiu", "Guardado"].map((label) => (
                <div key={label}>
                  <p className="text-xs text-muted">{label}</p>
                  <i className="mt-1.5 block h-3 w-16 rounded bg-surface3" />
                </div>
              ))}
            </div>
          </div>

          {/* Acerto entre duas pessoas */}
          <div className="absolute -top-12 -right-14 w-52 rounded-[1rem] bg-surface p-4 text-ink shadow-pop">
            <p className="text-xs text-muted">Acerto do mês</p>
            <div className="mt-2 flex">
              <span className="size-8 overflow-hidden rounded-full ring-2 ring-surface">
                <AvatarArt id="a1" className="size-full" />
              </span>
              <span className="-ml-2 size-8 overflow-hidden rounded-full ring-2 ring-surface">
                <AvatarArt id="a2" className="size-full" />
              </span>
            </div>
            <i className="mt-3 block h-3 w-32 rounded bg-ink/80" />
            <p className="mt-2 text-xs font-medium text-in">Divisão proporcional à renda</p>
          </div>

          {/* Próximos vencimentos */}
          <div className="relative -mb-6 ml-10 mt-5 rounded-[1rem] bg-surface p-4 text-ink shadow-pop">
            <p className="mb-2 text-xs text-muted">Próximos vencimentos</p>
            {[
              ["Luz", 42],
              ["Cartão de crédito", 268],
              ["Parcela do carro", 18],
            ].map(([name, hue]) => (
              <div key={name} className="flex items-center gap-3 border-t border-line py-2.5 first:border-t-0">
                <span
                  className="size-7 shrink-0 rounded-[0.45rem]"
                  style={{ background: `hsl(${hue} var(--cs) var(--cl))` }}
                />
                <b className="flex-1 text-sm font-medium">{name}</b>
                <i className="h-2.5 w-14 rounded bg-surface3" />
              </div>
            ))}
          </div>
        </div>
      </div>
      <figcaption className="relative px-8 pb-6 text-sm text-hero-mute">Ilustração</figcaption>
    </figure>
  );
}
