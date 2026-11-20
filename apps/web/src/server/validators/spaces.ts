import * as z from "zod";
import { idSchema, MESSAGES } from "./common";

export const spaceNameSchema = z
  .string({ error: MESSAGES.spaceNameShort })
  .trim()
  .min(2, { error: MESSAGES.spaceNameShort })
  .max(30, { error: MESSAGES.spaceNameLong });

export const createSpaceSchema = z.object({ name: spaceNameSchema });
export type CreateSpaceInput = z.input<typeof createSpaceSchema>;

export const renameSpaceSchema = z.object({ spaceId: idSchema, name: spaceNameSchema });
export type RenameSpaceInput = z.input<typeof renameSpaceSchema>;

export const deleteSpaceSchema = z.object({ spaceId: idSchema });
export type DeleteSpaceInput = z.input<typeof deleteSpaceSchema>;

export const switchSpaceSchema = z.object({ spaceId: idSchema });
export type SwitchSpaceInput = z.input<typeof switchSpaceSchema>;
