import {
  BookOpen,
  Briefcase,
  Car,
  Coins,
  CreditCard,
  Gift,
  Heart,
  House,
  type LucideIcon,
  Package,
  Plane,
  Shield,
  ShoppingCart,
  Star,
  Tag,
  Target,
  Tv,
  Wrench,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/cn";

/** Ícones das categorias (`ICONS` do protótipo), pelas chaves guardadas no banco. */
const ICONS: Record<string, LucideIcon> = {
  casa: House,
  contas: Zap,
  cartao: CreditCard,
  mercado: ShoppingCart,
  carro: Car,
  assinatura: Tv,
  saude: Heart,
  estudo: BookOpen,
  lazer: Star,
  caixa: Package,
  trabalho: Briefcase,
  dinheiro: Coins,
  reserva: Shield,
  etiqueta: Tag,
  presente: Gift,
  viagem: Plane,
  conserto: Wrench,
  alvo: Target,
  meta: Target,
};

export function categoryIconOf(icon: string): LucideIcon {
  return ICONS[icon] ?? Tag;
}

export interface CategoryIconProps {
  icon: string;
  hue: number;
  size?: "sm" | "md";
  className?: string;
}

/** Quadradinho colorido da categoria (`cic` do protótipo). Decorativo: o nome da categoria vem escrito ao lado. */
export function CategoryIcon({ icon, hue, size = "md", className }: CategoryIconProps) {
  const Icon = categoryIconOf(icon);
  return (
    <span
      aria-hidden="true"
      className={cn(
        "grid shrink-0 place-items-center",
        size === "md" ? "size-9 rounded-[0.6rem] [&_svg]:size-[1.125rem]" : "size-7 rounded-[0.45rem] [&_svg]:size-4",
        className,
      )}
      style={{ background: `hsl(${hue} var(--cs) var(--cl))`, color: `hsl(${hue} 50% var(--ci))` }}
    >
      <Icon />
    </span>
  );
}
