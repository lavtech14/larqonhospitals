import 'dotenv/config';

import { randomUUID } from 'node:crypto';
import { isEmail } from 'class-validator';

import { DatabaseService } from '../database/database.service.js';
import { hashPassword } from '../auth/password.js';
import { Prisma } from '../generated/prisma/client.js';

async function bootstrapAdmin() {
  const databaseUrl = process.env.BOOTSTRAP_DATABASE_URL;
  const email = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase();

  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;

  if (!databaseUrl) {
    throw new Error('BOOTSTRAP_DATABASE_URL is required.');
  }

  const target = new URL(databaseUrl);

  if (!['postgres:', 'postgresql:'].includes(target.protocol)) {
    throw new Error('A PostgreSQL connection URL is required.');
  }

  if (!email || !isEmail(email) || email.length > 254) {
    throw new Error('A valid bootstrap admin email is required.');
  }

  if (!password || password.length < 16 || password.length > 128) {
    throw new Error('Bootstrap password must contain 16–128 characters.');
  }

  // This changes the connection only inside this one-off process.
  process.env.DATABASE_URL = databaseUrl;

  const database = new DatabaseService();

  try {
    await database.$connect();

    console.log(`Target database host: ${target.hostname}`);

    const passwordHash = await hashPassword(password);

    const created = await database.$transaction(
      async (tx) => {
        await tx.$queryRaw`
          SELECT pg_advisory_xact_lock(982451653)::text
            AS "lockResult"
        `;

        // Do not reset or replace any existing administrator.
        const existingAdmin = await tx.staffUser.findFirst({
          where: {
            roles: {
              some: { role: 'ADMIN' },
            },
          },
          select: { id: true },
        });

        if (existingAdmin) {
          return false;
        }

        const existingEmail = await tx.staffUser.findUnique({
          where: { email },
          select: { id: true },
        });

        if (existingEmail) {
          throw new Error(
            'That email already belongs to a staff account. No changes were made.',
          );
        }

        const id = randomUUID();

        await tx.staffUser.create({
          data: {
            id,
            email,
            fullName: 'Staging Administrator',
            passwordHash,
            isActive: true,
            mustChangePassword: true,
            roles: {
              create: { role: 'ADMIN' },
            },
          },
        });

        await tx.auditEvent.create({
          data: {
            actorStaffId: id,
            action: 'INITIAL_ADMIN_CREATED',
            resourceType: 'StaffUser',
            resourceId: id,
          },
        });

        return true;
      },
      {
        maxWait: 5_000,
        timeout: 15_000,
      },
    );

    console.log(
      created
        ? 'Administrator created. Sign in and change the temporary password.'
        : 'An administrator already exists. Nothing was changed.',
    );
  } finally {
    await database.$disconnect();
  }
}

void bootstrapAdmin().catch((error: unknown) => {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    console.error('Database error code:', error.code);
  } else if (error instanceof Prisma.PrismaClientInitializationError) {
    console.error(
      'Database initialization failed:',
      error.errorCode ?? 'No error code',
    );
  } else if (
    error instanceof Error &&
    [
      'BOOTSTRAP_DATABASE_URL is required.',
      'A PostgreSQL connection URL is required.',
      'A valid bootstrap admin email is required.',
      'Bootstrap password must contain 16–128 characters.',
      'That email already belongs to a staff account. No changes were made.',
    ].includes(error.message)
  ) {
    console.error(error.message);
  } else {
    console.error(
      'Unexpected setup error:',
      error instanceof Error ? error.name : typeof error,
    );

    if (error instanceof TypeError) {
      console.error(
        'Check that the connection URL starts with postgresql:// and contains no surrounding quotes.',
      );
    }
  }

  process.exitCode = 1;
});
