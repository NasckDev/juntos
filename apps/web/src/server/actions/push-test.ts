"use server";

import * as z from "zod";
import { requireUser } from "../access";
import { getDb } from "../db";
import { isPushEnabled } from "../env";
import { sendPush } from "../push";
import { PUSH_TEST_MESSAGES } from "../push-test-messages";
import { enforceUserRateLimit, RATE_RULES } from "../rate-limit";
import { type ActionResult, DomainError, runAction } from "../result";

const noInput = z.undefined().or(z.object({}).strict());

export interface PushTestResult {
  /** Quantos aparelhos receberam. */
  readonly sent: number;
  /** Inscrições que o serviço de push disse não existirem mais (já apagadas). */
  readonly removed: number;
  readonly failed: number;
}

/** "Enviar notificação de teste": manda um aviso real para os aparelhos inscritos da pessoa. */
export async function sendTestPush(): Promise<ActionResult<PushTestResult>> {
  return runAction(noInput, undefined, async () => {
    if (!isPushEnabled()) throw new DomainError(PUSH_TEST_MESSAGES.disabled);
    const user = await requireUser();
    await enforceUserRateLimit(getDb(), RATE_RULES.pushTest, user.id);
    const result = await sendPush(getDb(), user.id, {
      title: "Juntos",
      body: "Notificação de teste: está tudo certo por aqui.",
      href: "/ajustes/avisos",
      tag: "teste",
    });
    if (!result.enabled) throw new DomainError(PUSH_TEST_MESSAGES.disabled);
    if (result.sent === 0) {
      throw new DomainError(
        result.failed > 0 && result.removed === 0 ? PUSH_TEST_MESSAGES.allFailed : PUSH_TEST_MESSAGES.noDevice,
      );
    }
    return { sent: result.sent, removed: result.removed, failed: result.failed };
  });
}
