import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import 'dotenv/config';

const currentFile = fileURLToPath(import.meta.url);
const projectRoot = path.join(path.dirname(currentFile), '..');
const prismaBin = path.join(
  projectRoot,
  'node_modules',
  '.bin',
  process.platform === 'win32' ? 'prisma.cmd' : 'prisma',
);

if (!isPostgresUrl(process.env.DATABASE_URL)) {
  console.error('DATABASE_URL must be set to a PostgreSQL URL before running prisma:generate.');
  process.exit(1);
}

const result = spawnSync(prismaBin, ['generate'], {
  cwd: projectRoot,
  env: process.env,
  stdio: 'inherit',
  shell: process.platform === 'win32',
});

if (result.error) {
  console.error(result.error);
  process.exit(1);
}

process.exit(result.status ?? 1);

function isPostgresUrl(value) {
  return /^postgres(?:ql)?:\/\//i.test(String(value || ''));
}
