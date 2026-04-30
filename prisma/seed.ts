import { PrismaClient, RoleType } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const email = 'aissaouimohsen@gmail.com';
  const password = '12345678';

  const hashedPassword = await bcrypt.hash(password, 10);

  const existing = await prisma.user.findUnique({
    where: { email },
  });

  if (existing) {
    await prisma.user.update({
      where: { email },
      data: {
        password: hashedPassword,
        role: RoleType.ADMIN,
      },
    });

    console.log('Admin password updated successfully');
    return;
  }

  await prisma.user.create({
    data: {
      email,
      password: hashedPassword,
      role: RoleType.ADMIN,
    },
  });

  console.log('Admin user created successfully');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });