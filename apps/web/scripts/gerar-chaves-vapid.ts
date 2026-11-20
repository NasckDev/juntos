/**
 * Gera o par de chaves VAPID das notificações push.
 * Uso: npm run chaves:vapid -w web
 * Copie as linhas para o .env.local (desenvolvimento) e para as variáveis da Vercel (produção).
 * Gere uma vez só: trocar as chaves invalida as inscrições de push já feitas nos aparelhos.
 */
import { generateVAPIDKeys } from "web-push";

const { publicKey, privateKey } = generateVAPIDKeys();

console.log("# Chaves VAPID (notificações push). A privada é segredo: nunca versione.");
console.log(`NEXT_PUBLIC_VAPID_PUBLIC_KEY=${publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${privateKey}`);
console.log("VAPID_SUBJECT=mailto:seu-email@example.com");
