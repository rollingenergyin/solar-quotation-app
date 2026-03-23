import { PrismaClient } from '@prisma/client';

const DEFAULT_CATEGORIES = [
  'SITE_EXPENSE',
  'COMMERCIAL_EXPENSE',
  'SURYAGHAR_LOANS',
  'OVERHEADS',
  'MARKETING',
  'ALLOWANCES',
  'SALARIES',
  'FOOD_ACCOMMODATION',
  'MISC',
];

async function main() {
  const prisma = new PrismaClient();
  for (const name of DEFAULT_CATEGORIES) {
    await prisma.transactionCategory.upsert({
      where: { name },
      create: { name },
      update: {},
    });
  }
  console.log('Seeded', DEFAULT_CATEGORIES.length, 'transaction categories');
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
