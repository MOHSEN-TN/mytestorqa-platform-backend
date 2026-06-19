// prisma/seed.ts
import { PrismaClient, RoleType } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const defaultUsers = [
    {
      email: 'admin@testflow.com',
      password: await bcrypt.hash('Admin123!', 10),
      role: RoleType.ADMIN,
      firstName: 'Super',
      lastName: 'Admin',
    },
    {
      email: 'aissaouimohsen@gmail.com',
      password: await bcrypt.hash('Admin12345!', 10),
      role: RoleType.ADMIN,
      firstName: 'Mohsen',
      lastName: 'Aissaoui',
    },
    {
      email: 'qalead@testflow.com',
      password: await bcrypt.hash('QALead123!', 10),
      role: RoleType.QA_LEAD,
      firstName: 'QA',
      lastName: 'Lead',
    },
    {
      email: 'tester@testflow.com',
      password: await bcrypt.hash('Tester123!', 10),
      role: RoleType.TESTER,
      firstName: 'Test',
      lastName: 'User',
    },
  ];

  for (const user of defaultUsers) {
    await prisma.user.upsert({
      where: { email: user.email },
      update: {
        password: user.password,
        role: user.role,
        firstName: user.firstName,
        lastName: user.lastName,
      },
      create: user,
    });
  }

  console.log('✅ Utilisateurs par défaut créés / mis à jour');
}

main()
  .catch((e) => {
    console.error('❌ Erreur de seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });