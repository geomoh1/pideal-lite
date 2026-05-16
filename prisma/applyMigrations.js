import 'dotenv/config';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';

process.env.DATABASE_URL ||= 'file:./dev.db';

const prisma = new PrismaClient();
const currentFile = fileURLToPath(import.meta.url);
const migrationsDir = path.join(path.dirname(currentFile), 'migrations');

try {
  const migrationNames = (await readdir(migrationsDir, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  for (const migrationName of migrationNames) {
    const sqlPath = path.join(migrationsDir, migrationName, 'migration.sql');
    const sql = await readFile(sqlPath, 'utf8');

    for (const statement of sql.split(';').map((item) => item.trim()).filter(Boolean)) {
      try {
        await prisma.$executeRawUnsafe(statement);
      } catch (error) {
        if (!isIdempotentMigrationError(error)) {
          throw error;
        }
      }
    }

    console.log(`Applied migration ${migrationName}`);
  }
} finally {
  await prisma.$disconnect();
}

function isIdempotentMigrationError(error) {
  const message = String(error?.message || '').toLowerCase();
  return message.includes('duplicate column name') || message.includes('already exists');
}
