import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const password = await bcrypt.hash('Admin123!', 10);

  await prisma.user.upsert({
    where: { email: 'admin@solar.com' },
    update: { password },
    create: {
      name: 'Admin',
      email: 'admin@solar.com',
      userId: 'admin',
      password,
      role: 'ADMIN',
    },
  });
}

main()
  .catch((e) => console.error(e))
  .finally(() => prisma.$disconnect());
