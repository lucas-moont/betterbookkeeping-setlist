import { createServerOnlyFn } from "@tanstack/react-start";
import { Algorithm, hash, verify } from "@node-rs/argon2";

/** Every argon2 hash starts with this. Anything else in User.password is legacy plaintext. */
export const passwordHashPrefix = "$argon2";

// argon2id with the OWASP-recommended parameters (ADR 0005). They match the library defaults
// today, and are pinned here so a library upgrade can't silently weaken new hashes.
const options = {
  algorithm: Algorithm.Argon2id,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
};

export const hashPassword = createServerOnlyFn((password: string): Promise<string> => hash(password, options));

/**
 * Checks a password against a stored argon2 hash. Anything that isn't a well-formed argon2 hash,
 * including legacy plaintext, never verifies: sign-in has no plaintext comparison path.
 */
export const verifyPassword = createServerOnlyFn(async (storedHash: string, password: string): Promise<boolean> => {
  if (!storedHash.startsWith(passwordHashPrefix)) return false;
  try {
    return await verify(storedHash, password);
  } catch {
    return false;
  }
});
