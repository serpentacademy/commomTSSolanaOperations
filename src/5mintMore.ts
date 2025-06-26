import {
  Connection,
  clusterApiUrl,
  Keypair,
  PublicKey,
} from "@solana/web3.js";
import {
  getMint,
  getAccount,
  mintTo,
} from "@solana/spl-token";
import * as fs from "node:fs";
import * as path from "node:path";

async function main() {
  /* ── 1. Load wallet.json ─────────────────────────────────────────── */
  const secret = Uint8Array.from(
    JSON.parse(fs.readFileSync(path.resolve("wallet.json"), "utf8"))
  );
  const wallet = Keypair.fromSecretKey(secret);

  /* ── 2. Load token.json ──────────────────────────────────────────── */
  const { tokenAddress, tokenAccount } = JSON.parse(
    fs.readFileSync(path.resolve("token.json"), "utf8")
  ) as { tokenAddress: string; tokenAccount: string };

  const MINT = new PublicKey(tokenAddress);
  const ATA  = new PublicKey(tokenAccount);

  /* ── 3. Connect to devnet ────────────────────────────────────────── */
  const connection = new Connection(clusterApiUrl("devnet"), "confirmed");

  /* ── 4. Fetch mint + decimals ────────────────────────────────────── */
  const mintInfo = await getMint(connection, MINT);
  const decimals = mintInfo.decimals;

  /* ── 5. Amount = 100 whole tokens → base units ───────────────────── */
  const wholeTokens = 100n;
  const amount      = wholeTokens * 10n ** BigInt(decimals);

  /* ── 6. Mint! ─────────────────────────────────────────────────────── */
  const sig = await mintTo(
    connection,
    wallet,          // payer + authority
    MINT,
    ATA,
    wallet,          // mint authority
    amount
  );

  /* ── 7. Show new balance ─────────────────────────────────────────── */
  const acctInfo = await getAccount(connection, ATA);
  const uiBalance =
    Number(acctInfo.amount) / 10 ** decimals;

  console.log("✅  Minted", wholeTokens.toString(), "tokens");
  console.log("🖋️  Signature:", sig);
  console.log("💰  New balance:", uiBalance.toLocaleString(), "tokens");
}

main().catch((e) => {
  console.error("❌  Error:", e);
  process.exit(1);
});
