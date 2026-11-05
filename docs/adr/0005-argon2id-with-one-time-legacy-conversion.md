# Passwords use argon2id, and legacy plaintext is converted once

Passwords are hashed with argon2id (the current OWASP recommendation) through `@node-rs/argon2`, which ships prebuilt binaries and needs no node-gyp. `Bun.password` isn't an option: the server runs on Node, not Bun. `bunx vite` follows Vite's `node` shebang, and the production build uses Nitro's `node-server` preset.

Passwords already stored in plaintext are converted once by an idempotent script that runs after `prisma migrate deploy` and hashes every value that doesn't start with `$argon2`. A SQL migration can't do this, because Postgres has no argon2 function. After the conversion, sign-in only ever verifies hashes.

## Considered Options

- **Re-hash on next sign-in.** Needs no script, but plaintext stays in the database until each user comes back, and sign-in keeps an insecure plaintext comparison forever.
- **bcrypt via `bcryptjs`.** Pure JS, so there's nothing to compile, but it silently truncates passwords at 72 bytes and runs slower.
- **`scrypt` from `node:crypto`.** No dependency, but the salt and parameter encoding would have to be written by hand.
