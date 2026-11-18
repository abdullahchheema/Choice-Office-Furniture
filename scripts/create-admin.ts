/**
 * Creates (or resets) an administrator account.
 *
 *   npm run admin:create -- --email owner@yourshop.pk --name "Store Owner"
 *   npm run admin:create -- --email owner@yourshop.pk --reset      # new password
 *
 * The password is read from a hidden prompt, or from ADMIN_PASSWORD for
 * non-interactive use. It is never accepted as a command-line argument, which
 * would leave it in shell history and in the process list.
 *
 * This is how production gets its first admin. The seed is for development:
 * it creates a demo catalogue and reads the password from a file.
 */
import { hash } from "@node-rs/argon2";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { config } from "dotenv";
import { createInterface } from "node:readline";

config({ path: ".env.local", quiet: true });
config({ quiet: true });

const args = process.argv.slice(2);
const flag = (name: string) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? undefined : (args[i + 1]?.startsWith("--") ? "" : (args[i + 1] ?? ""));
};
const has = (name: string) => args.includes(`--${name}`);

/** Reads a line without echoing it. */
function promptHidden(question: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    const write = (rl as unknown as { _writeToOutput: (s: string) => void })._writeToOutput;
    process.stdout.write(question);
    (rl as unknown as { _writeToOutput: (s: string) => void })._writeToOutput = (s: string) => {
      if (s.includes("\n") || s.includes("\r")) write.call(rl, s);
    };
    rl.question("", (answer) => {
      rl.close();
      process.stdout.write("\n");
      resolve(answer);
    });
  });
}

async function main() {
  const email = (flag("email") ?? "").trim().toLowerCase();
  const name = (flag("name") ?? "Store Owner").trim() || "Store Owner";
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    console.error('Usage: npm run admin:create -- --email you@example.com [--name "Full Name"] [--reset]');
    process.exit(2);
  }

  const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("DIRECT_URL (or DATABASE_URL) is not set.");
    process.exit(2);
  }

  let password = process.env.ADMIN_PASSWORD ?? "";
  if (!password) {
    if (!process.stdin.isTTY) {
      console.error("No terminal to prompt on. Set ADMIN_PASSWORD for this one command instead.");
      process.exit(2);
    }
    password = await promptHidden("Password (min 12 characters): ");
    const again = await promptHidden("Repeat password: ");
    if (password !== again) {
      console.error("The passwords do not match.");
      process.exit(1);
    }
  }
  if (password.length < 12) {
    console.error("The password must be at least 12 characters.");
    process.exit(1);
  }

  // Same parameters as lib/auth/password.ts (argon2id, OWASP interactive baseline).
  const passwordHash = await hash(password, { memoryCost: 19456, timeCost: 2, parallelism: 1 });

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  try {
    const existing = await prisma.adminUser.findUnique({ where: { email } });
    if (existing && !has("reset")) {
      console.error(`${email} already exists. Re-run with --reset to set a new password.`);
      process.exit(1);
    }

    if (existing) {
      await prisma.adminUser.update({
        where: { email },
        data: {
          passwordHash,
          isActive: true,
          failedLogins: 0,
          lockedUntil: null,
          // Revokes every session issued before now, on every device.
          sessionEpoch: { increment: 1 },
        },
      });
      console.log(`Password reset for ${email}. All existing sessions were signed out.`);
    } else {
      await prisma.adminUser.create({ data: { email, name, passwordHash } });
      console.log(`Created admin ${email}. Sign in at /admin/login.`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
