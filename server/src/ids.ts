import { randomBytes, randomInt, randomUUID } from "node:crypto";

// No 0/O, 1/I/L: codes are read aloud and typed on phones.
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const CODE_LENGTH = 5;

/** A short, human-friendly match code like "K7QPX", unique among `taken`. */
export function newMatchCode(taken: (code: string) => boolean): string {
  for (;;) {
    let code = "";
    for (let i = 0; i < CODE_LENGTH; i++) code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
    if (!taken(code)) return code;
  }
}

export const newPlayerId = (): string => randomUUID();

/** Secret proof of seat ownership for rejoining. Never included in a MatchView. */
export const newToken = (): string => randomBytes(24).toString("base64url");
