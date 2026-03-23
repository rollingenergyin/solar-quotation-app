/**
 * CLI script to upload a bank statement file directly (bypasses HTTP auth).
 * Usage: npx tsx scripts/upload-bank-statement.ts <path-to-file>
 * Example: npx tsx scripts/upload-bank-statement.ts "../../FY 2025-26 till 13 march all.xlsx"
 */

import * as fs from 'fs';
import * as path from 'path';
import { uploadAndProcess } from '../src/services/bank-statement.service.js';

async function main() {
  const filePath = process.argv[2] || path.join(process.cwd(), '..', '..', 'FY 2025-26 till 13 march all.xlsx');
  const resolved = path.resolve(filePath);

  if (!fs.existsSync(resolved)) {
    console.error('File not found:', resolved);
    process.exit(1);
  }

  const buffer = fs.readFileSync(resolved);
  const fileName = path.basename(resolved);

  console.log('Uploading:', fileName, `(${(buffer.length / 1024).toFixed(1)} KB)`);

  try {
    const result = await uploadAndProcess(buffer, fileName, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    console.log('\n✓ Upload complete:');
    console.log('  Upload ID:', result.uploadId);
    console.log('  Transactions created:', result.transactionsCreated);
    console.log('  Total rows processed:', result.totalRows);
    console.log('  Duplicates skipped:', result.duplicatesSkipped);
  } catch (err) {
    console.error('Upload failed:', err);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

main();
