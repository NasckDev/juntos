/** Textos de `sendTestPush`. Ficam fora do arquivo da action porque "use server" só exporta funções assíncronas. */
export const PUSH_TEST_MESSAGES = {
  disabled: "As notificações no aparelho ainda não foram configuradas neste servidor.",
  noDevice: "Nenhum aparelho está inscrito. Ative as notificações neste aparelho e tente de novo.",
  allFailed: "O serviço de notificações recusou o envio. Tente de novo em instantes.",
} as const;
