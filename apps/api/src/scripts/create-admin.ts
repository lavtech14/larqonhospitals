import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';
import { hashPassword, verifyPassword } from '../auth/password.js';

async function main() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('This bootstrap command is for development only.');
  }

  const connectionString = process.env.DATABASE_URL;
  const email = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase();
  const fullName = process.env.BOOTSTRAP_ADMIN_NAME?.trim();
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;

  if (!connectionString || !email || !fullName || !password) {
    throw new Error('Required database or bootstrap variables are missing.');
  }

  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('Enter a valid admin email.');
  }

  if (fullName.length < 2 || fullName.length > 100) {
    throw new Error('Admin name must contain 2-100 characters.');
  }

  if (password.length < 16 || password.length > 128) {
    throw new Error('Use an admin password containing 16-128 characters.');
  }

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  });

  try {
    const existing = await prisma.staffUser.findUnique({
      where: { email },
      select: { id: true },
    });

    if (existing) {
      throw new Error(
        'This email already exists. No account or permissions were changed.',
      );
    }

    const passwordHash = await hashPassword(password);

    if (!(await verifyPassword(passwordHash, password))) {
      throw new Error('Password verification check failed.');
    }

    await prisma.staffUser.create({
      data: {
        email,
        fullName,
        passwordHash,
        isActive: true,
        mustChangePassword: true,
        passwordChangedAt: new Date(),
        roles: {
          create: {
            role: 'ADMIN',
          },
        },
      },
      select: {
        id: true,
      },
    });

    console.log('Development admin created successfully.');
    console.log('Password change is required at first login.');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(() => {
  console.error(
    'Admin creation failed. Check the bootstrap values, database connection, ' +
      'and whether the email already exists.',
  );
  process.exitCode = 1;
});
