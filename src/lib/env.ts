export class MissingEnvError extends Error {
  constructor(public readonly variable: string) {
    super(
      `${variable} is not set. Add it to .env (see .env.example) or to the host's environment, then restart.`,
    );
    this.name = "MissingEnvError";
  }
}

export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === "") throw new MissingEnvError(name);
  return value.trim();
}

export function appUrl(): string {
  return (process.env.APP_URL ?? "http://localhost:3000").replace(/\/+$/, "");
}

/** The only PayPal value that is allowed to reach the browser. */
export function publicPayPalClientId(): string | null {
  return process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID?.trim() || process.env.PAYPAL_CLIENT_ID?.trim() || null;
}
