"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Card, CardHeader } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { updatePreferences } from "@/server/actions/account";
import type { NotifyPreferences } from "@/server/db/schema";
import { PushCard, type PushCardProps } from "./push-card";

/** Os 6 tipos de aviso, com os textos do protótipo (`vAjustes`, aba Avisos). */
export const NOTIFY_ITEMS: readonly { key: keyof NotifyPreferences; label: string }[] = [
  { key: "late", label: "Contas atrasadas" },
  { key: "due", label: "Contas que vencem em até 3 dias" },
  { key: "budget", label: "Orçamento perto do limite ou estourado" },
  { key: "goal", label: "Meta alcançada" },
  { key: "auto", label: "Contas fixas lançadas no mês" },
  { key: "people", label: "Convites e pessoas do espaço" },
];

export interface AvisosPanelProps {
  notify: NotifyPreferences;
  push: PushCardProps;
}

export function AvisosPanel({ notify, push }: AvisosPanelProps) {
  const [values, setValues] = useState<NotifyPreferences>(notify);

  async function toggle(key: keyof NotifyPreferences, checked: boolean) {
    const previous = values;
    setValues({ ...values, [key]: checked });
    const result = await updatePreferences({ notify: { [key]: checked } });
    if (!result.ok) {
      setValues(previous);
      toast.error(result.error);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2 lg:items-start lg:gap-6">
      <Card>
        <CardHeader title="Avisos no app" description="Aparecem no sino, no alto da tela." />
        <div className="divide-y divide-line">
          {NOTIFY_ITEMS.map((item) => (
            <Switch
              key={item.key}
              label={item.label}
              checked={values[item.key]}
              onCheckedChange={(checked) => void toggle(item.key, checked)}
              className="py-1.5"
            />
          ))}
        </div>
      </Card>
      <Card>
        <CardHeader title="No celular" description="Notificações do navegador, como as de um aplicativo." />
        <PushCard {...push} />
      </Card>
    </div>
  );
}
