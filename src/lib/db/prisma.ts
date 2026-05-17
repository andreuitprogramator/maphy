import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
let productionClient: PrismaClient | undefined;

function getConnectionString() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("Missing DATABASE_URL");
  return url;
}

function createPrismaClient() {
  return new PrismaClient({
    adapter: new PrismaPg({ connectionString: getConnectionString() }),
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

function hasDelegate(client: PrismaClient, name: string): boolean {
  const v = (client as unknown as Record<string, unknown>)[name];
  return typeof v === "object" && v !== null;
}

function resolvePrismaClient(): PrismaClient {
  if (process.env.NODE_ENV === "production") {
    if (!productionClient) {
      productionClient = createPrismaClient();
    }
    return productionClient;
  }

  const cached = globalForPrisma.prisma;
  if (
    cached &&
    hasDelegate(cached, "notification") &&
    hasDelegate(cached, "contestSet") &&
    hasDelegate(cached, "contestSetProblem") &&
    hasDelegate(cached, "contestSetAttachment")
  ) {
    return cached;
  }
  const next = createPrismaClient();
  globalForPrisma.prisma = next;
  return next;
}

/**
 * Lazy resolve so dev/Turbopack module cache can reuse one client instance.
 */
export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop, _receiver) {
    const client = resolvePrismaClient();
    const value = Reflect.get(client as object, prop, client) as unknown;
    if (typeof value === "function") {
      return (value as (...args: unknown[]) => unknown).bind(client);
    }
    return value;
  },
});
