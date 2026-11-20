import * as z from "zod";

export const undoSchema = z.object({
  token: z.uuid({ error: "Não dá mais para desfazer." }),
});
export type UndoInput = z.input<typeof undoSchema>;
