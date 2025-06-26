// grindWallet.ts
// -----------------------------------------------------------------------------
// Generates Solana keypairs until the public key (base‑58) starts with the
// prefix defined in TARGET_PREFIX. When a match is found, the script saves the
// keypair to **walletgrind.json** in the current working directory.
//
// Run with 👉  npx ts-node grindWallet.ts
// -----------------------------------------------------------------------------
import { Keypair } from '@solana/web3.js';
import bs58 from 'bs58';
import { writeFileSync } from 'fs';

const TARGET_PREFIX = 'ITO';      // ✅ change to any prefix you like
const LOG_EVERY     = 10_000;     // print a status line every N attempts
const OUTPUT_FILE   = 'walletgrind.json';

let tries  = 0;
let start  = Date.now();

while (true) {
  // 1️⃣ generate a fresh keypair
  const kp  = Keypair.generate();
  const pub = bs58.encode(kp.publicKey.toBytes()); // base‑58 encoded address

  // 2️⃣ check for the vanity prefix
  if (pub.startsWith(TARGET_PREFIX) || pub.startsWith("ito") || pub.startsWith("ITo") || pub.startsWith("iTo")) {
    const runTime = ((Date.now() - start) / 1000).toFixed(2);
    console.log(`\n🟢 Found vanity wallet in ${runTime}s after ${tries.toLocaleString()} tries`);
    console.log('Public key :', pub);
    console.log('Secret key :', bs58.encode(kp.secretKey));

    // 3️⃣ save to JSON file
    const walletInfo = {
      publicKey: pub,
      secretKey: bs58.encode(kp.secretKey),
    } as const;

    writeFileSync(OUTPUT_FILE, JSON.stringify(walletInfo, null, 2));
    console.log(`\n💾 Saved keypair to ${OUTPUT_FILE}`);
    break;
  }

  // 4️⃣ log progress every LOG_EVERY iterations
  if (++tries % LOG_EVERY === 0) {
    const rate = (tries / ((Date.now() - start) / 1000)).toFixed(0);
    process.stdout.write(`\r🔄  Tried ${tries.toLocaleString()} keys … ${rate} keys/s   `);
  }
}
