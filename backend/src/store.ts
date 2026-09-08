import { PrismaClient, type Prisma, type DemoUser } from "@prisma/client";
import type { Language } from "./products.js";
export const DEMO_ID = "demo";
export type LockedUser = { user: DemoUser; tx: Prisma.TransactionClient };
export class Store {
  constructor(public db: PrismaClient) {}
  user() {
    return this.db.demoUser.findUniqueOrThrow({ where: { id: DEMO_ID } });
  }
  recent() {
    return this.db.recentSearch.findMany({
      where: { userId: DEMO_ID },
      orderBy: [{ lastSearchedAt: "desc" }, { id: "desc" }],
      take: 10,
      select: { term: true, language: true },
    });
  }
  // The single user's row serializes billing reconciliation, Checkout, and history writes across processes.
  async locked<T>(action: (context: LockedUser) => Promise<T>): Promise<T> {
    return this.db.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT id FROM DemoUser WHERE id = ${DEMO_ID} FOR UPDATE`;
        const user = await tx.demoUser.findUniqueOrThrow({
          where: { id: DEMO_ID },
        });
        return action({ user, tx });
      },
      { maxWait: 5000, timeout: 20_000 },
    );
  }
  async saveSearch(term: string, language: Language) {
    await this.locked(async ({ tx }) => {
      await tx.recentSearch.upsert({
        where: { userId_term_language: { userId: DEMO_ID, term, language } },
        create: { userId: DEMO_ID, term, language },
        update: { lastSearchedAt: new Date() },
      });
      const old = await tx.recentSearch.findMany({
        where: { userId: DEMO_ID },
        orderBy: [{ lastSearchedAt: "desc" }, { id: "desc" }],
        skip: 10,
        select: { id: true },
      });
      if (old.length)
        await tx.recentSearch.deleteMany({
          where: { id: { in: old.map((s) => s.id) } },
        });
    });
  }
}
