import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../.env') });

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const email = process.argv[2] || 'finance@rollingenergy.in';
const password = process.argv[3] || 'Finance123!';
const name = process.argv[4] || 'Finance User';

async function main() {
  const hashedPassword = await bcrypt.hash(password, 12);
  const userId = email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '_');

  await prisma.user.upsert({
    where: { email },
    update: { password: hashedPassword, role: 'FINANCE' },
    create: {
      name,
      email,
      userId,
      password: hashedPassword,
      role: 'FINANCE',
    },
  });

  console.log(`Finance user created/updated: ${email} (role: FINANCE)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
