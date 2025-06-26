import {
  Connection,
  clusterApiUrl,
  Keypair,
  PublicKey,
} from "@solana/web3.js";
import {
  getMint,
  getAccount,
  getOrCreateAssociatedTokenAccount,
  transfer,
} from "@solana/spl-token";
import * as fs from "node:fs";
import * as path from "node:path";

async function main() {
  /* ── 1. Load wallet & mint info ─────────────────────────────── */
  const secret = Uint8Array.from(
    JSON.parse(fs.readFileSync(path.resolve("wallet.json"), "utf8"))
  );
  const wallet = Keypair.fromSecretKey(secret);

  const { tokenAddress, tokenAccount } = JSON.parse(
    fs.readFileSync(path.resolve("token.json"), "utf8")
  ) as { tokenAddress: string; tokenAccount: string };

  const MINT = new PublicKey(tokenAddress);
  const SOURCE_ATA = new PublicKey(tokenAccount);

  const RECIPIENT = new PublicKey(
    "Lux8W2ibuWmhJ4Enp8CpK6aeBsSS5xrn2YN7g6gqk48"
  );

  /* ── 2. Connect to devnet ───────────────────────────────────── */
  const connection = new Connection(clusterApiUrl("devnet"), "confirmed");

  /* ── 3. Fetch mint decimals and source balance ──────────────── */
  const [mintInfo, sourceInfo] = await Promise.all([
    getMint(connection, MINT),
    getAccount(connection, SOURCE_ATA),
  ]);
  const decimals = mintInfo.decimals;

  /* ── 4. Amount: 50 tokens → base units ──────────────────────── */
  const wholeTokens = 50n;
  const amount = wholeTokens * 10n ** BigInt(decimals);

  if (sourceInfo.amount < amount) {
    throw new Error(
      `Insufficient balance: have ${
        Number(sourceInfo.amount) / 10 ** decimals
      }, need ${wholeTokens}`
    );
  }

  /* ── 5. Ensure recipient ATA exists ─────────────────────────── */
  const recipientATA = await getOrCreateAssociatedTokenAccount(
    connection,
    wallet,      // payer for rent if a new account is created
    MINT,
    RECIPIENT
  );

  /* ── 6. Transfer ────────────────────────────────────────────── */
  const sig = await transfer(
    connection,
    wallet,          // fee payer
    SOURCE_ATA,      // from
    recipientATA.address,
    wallet,          // owner of source
    amount
  );

  /* ── 7. Report ──────────────────────────────────────────────── */
  const newSourceInfo = await getAccount(connection, SOURCE_ATA);
  const newBalance =
    Number(newSourceInfo.amount) / 10 ** decimals;

  console.log("✅  Transferred", wholeTokens.toString(), "tokens");
  console.log("🖋️  Signature:", sig);
  console.log("💳  New source balance:", newBalance.toLocaleString(), "tokens");
}

main().catch((err) => {
  console.error("❌  Error:", err);
  process.exit(1);
});
