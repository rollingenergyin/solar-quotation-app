/**
 * Production start helper.
 *
 * Tries Prisma migrate deploy first. If migration history has drifted
 * (common in this project), fall back to applying critical idempotent SQL
 * so new columns/tables still land before the API starts.
 */

import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function run(cmd: string, args: string[], allowFailure = false): number {
  console.log(`[prod-start] ${cmd} ${args.join(' ')}`);
  const result = spawnSync(cmd, args, {
    cwd: root,
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: process.env,
  });
  const code = result.status ?? 1;
  if (code !== 0 && !allowFailure) {
    process.exit(code);
  }
  return code;
}

const migrateCode = run('npx', ['prisma', 'migrate', 'deploy'], true);
if (migrateCode !== 0) {
  console.warn(
    '[prod-start] prisma migrate deploy failed (often due to drifted _prisma_migrations history). Applying critical idempotent SQL next; startup-schema-fix will also run on boot.',
  );
}

const criticalSql = [
  'prisma/migrations/20260601120000_add_template_bank_details/migration.sql',
  'prisma/migrations/20260601140000_add_quotation_global_settings/migration.sql',
  'prisma/migrations/20260601150000_add_bom_options/migration.sql',
  'prisma/migrations/20260714120000_ensure_template_bom_bank_details/migration.sql',
];

for (const file of criticalSql) {
  run('npx', ['prisma', 'db', 'execute', '--file', file], true);
}

run('node', ['dist/index.js'], false);
