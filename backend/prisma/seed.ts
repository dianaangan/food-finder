import "dotenv/config";
import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();
try {
  await db.demoUser.upsert({
    where: { id: "demo" },
    create: { id: "demo" },
    update: {},
  });
} finally {
  await db.$disconnect();
}
