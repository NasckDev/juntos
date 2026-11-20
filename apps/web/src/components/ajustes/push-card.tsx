"use client";

import { BellRing, Info, LoaderCircle, Send } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  isPushSupported,
  needsHomeScreenInstall,
  readDevicePushState,
  subscribeThisDevice,
  toSubscriptionInput,
  unsubscribeThisDevice,
} from "@/lib/push-client";
import { removePushSubscription, savePushSubscription } from "@/server/actions/push";
import { sendTestPush } from "@/server/actions/push-test";

export interface PushCardProps {
  /** `features.push`: o servidor tem as chaves VAPID. */
  serverEnabled: boolean;
  /** `features.vapidPublicKey`. */
  vapidPublicKey: string | null;
}

type PushStatus = "checking" | "unsupported" | "install-ios" | "server-off" | "denied" | "off" | "on";

export const PUSH_COPY = {
  serverOff: "As notificações no celular ainda não foram configuradas neste ambiente.",
  unsupported: "Este navegador não tem suporte a notificações no aparelho.",
  installIos:
    "No iPhone e no iPad, os avisos só chegam com o Juntos na Tela de Início: no Safari, toque em Compartilhar, depois em “Adicionar à Tela de Início”, e abra o app por lá.",
  denied:
    "As notificações estão bloqueadas neste navegador. Libere nas configurações do site (o cadeado ao lado do endereço) e volte aqui.",
  dismissed: "Sem a sua permissão, não dá para ativar as notificações. Tente de novo quando quiser.",
  failed: "Não foi possível ativar as notificações agora. Tente de novo em instantes.",
} as const;

const EXPLANATION: Partial<Record<PushStatus, string>> = {
  "server-off": PUSH_COPY.serverOff,
  unsupported: PUSH_COPY.unsupported,
  "install-ios": PUSH_COPY.installIos,
  denied: PUSH_COPY.denied,
};

/** Notificações no celular (Web Push): pede permissão, registra o service worker, inscreve e avisa o servidor. */
export function PushCard({ serverEnabled, vapidPublicKey }: PushCardProps) {
  const [status, setStatus] = useState<PushStatus>("checking");
  const [busy, setBusy] = useState<"toggle" | "test" | null>(null);

  const refresh = useCallback(async () => {
    if (!serverEnabled || !vapidPublicKey) return setStatus("server-off");
    if (needsHomeScreenInstall()) return setStatus("install-ios");
    if (!isPushSupported()) return setStatus("unsupported");
    try {
      const state = await readDevicePushState();
      if (state.permission === "denied") return setStatus("denied");
      setStatus(state.subscription && state.permission === "granted" ? "on" : "off");
    } catch {
      setStatus("off");
    }
  }, [serverEnabled, vapidPublicKey]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function enable() {
    if (!vapidPublicKey) return;
    setBusy("toggle");
    try {
      const outcome = await subscribeThisDevice(vapidPublicKey);
      if (outcome.status === "denied") return setStatus("denied");
      if (outcome.status === "dismissed") return void toast(PUSH_COPY.dismissed);
      if (outcome.status === "error") return void toast.error(PUSH_COPY.failed);
      const input = toSubscriptionInput(outcome.subscription);
      const saved = input ? await savePushSubscription(input) : null;
      if (!saved?.ok) {
        await unsubscribeThisDevice();
        return void toast.error(saved ? saved.error : PUSH_COPY.failed);
      }
      setStatus("on");
      toast.success("Notificações ativadas neste aparelho.");
    } finally {
      setBusy(null);
    }
  }

  async function disable() {
    setBusy("toggle");
    try {
      const endpoint = await unsubscribeThisDevice();
      if (endpoint) {
        const removed = await removePushSubscription({ endpoint });
        if (!removed.ok) toast.error(removed.error);
      }
      setStatus("off");
      toast("Notificações desativadas neste aparelho.");
    } catch {
      toast.error("Não foi possível desativar agora. Tente de novo.");
    } finally {
      setBusy(null);
    }
  }

  async function sendTest() {
    setBusy("test");
    try {
      // Garante que o servidor conhece este aparelho (a inscrição pode ter sido apagada por lá).
      const { subscription } = await readDevicePushState();
      const input = subscription ? toSubscriptionInput(subscription) : null;
      if (input) await savePushSubscription(input);
      const result = await sendTestPush();
      if (!result.ok) return void toast.error(result.error);
      const { sent } = result.data;
      toast.success(
        sent === 1
          ? "Notificação enviada. Ela deve chegar em instantes."
          : `Notificação enviada para ${sent} aparelhos.`,
      );
    } finally {
      setBusy(null);
    }
  }

  const spinner = <LoaderCircle aria-hidden="true" className="animate-spin" />;
  const explanation = EXPLANATION[status];

  return (
    <div>
      {status === "checking" ? <p className="text-sm text-muted">Verificando este aparelho…</p> : null}

      {explanation ? (
        <p className="flex gap-2.5 rounded-field bg-surface2 p-3.5 text-sm text-muted">
          <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <span>{explanation}</span>
        </p>
      ) : null}

      {status === "off" ? (
        <div>
          <p className="mb-3 text-sm text-muted">
            Receba os avisos mesmo com o Juntos fechado. O navegador vai pedir a sua permissão.
          </p>
          <Button icon={busy ? spinner : <BellRing />} disabled={busy !== null} onClick={() => void enable()}>
            Ativar notificações neste aparelho
          </Button>
        </div>
      ) : null}

      {status === "on" ? (
        <div>
          <p className="mb-3 text-sm font-medium text-in">Ativadas neste aparelho.</p>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="line"
              icon={busy === "test" ? spinner : <Send />}
              disabled={busy !== null}
              onClick={() => void sendTest()}
            >
              Enviar notificação de teste
            </Button>
            <Button variant="ghost" disabled={busy !== null} onClick={() => void disable()}>
              Desativar neste aparelho
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
