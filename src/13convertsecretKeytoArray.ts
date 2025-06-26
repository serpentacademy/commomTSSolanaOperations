// convertWallet.ts
// -----------------------------------------------------------------------------
// Reads walletgrind.json (created by grindWallet.ts) and writes
// walletgrindarray.json containing the secret key as a plain array of integers.
//
// Run with 👉  npx ts-node convertWallet.ts
// -----------------------------------------------------------------------------
import { readFileSync, writeFileSync } from 'fs';
import bs58 from 'bs58';

const INFO_FILE  = 'walletgrind.json';      // input
const ARRAY_FILE = 'walletgrindarray.json'; // output

try {
  // 1️⃣ read & parse walletgrind.json ---------------------------------------
  const json = JSON.parse(readFileSync(INFO_FILE, 'utf8')) as {
    publicKey: string;
    secretKey: string; // base‑58
  };

  if (!json.secretKey) throw new Error('secretKey missing in walletgrind.json');

  // 2️⃣ decode base‑58 → Uint8Array → number[] ------------------------------
  const secretArray = Array.from(bs58.decode(json.secretKey));

  // 3️⃣ write walletgrindarray.json -----------------------------------------
  writeFileSync(ARRAY_FILE, JSON.stringify(secretArray));
  console.log(`💾 Saved Uint8 secret key to ${ARRAY_FILE}`);
} catch (err) {
  console.error('❌', err instanceof Error ? err.message : err);
}
