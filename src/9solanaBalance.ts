import { Connection, Keypair, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { readFileSync } from "node:fs";

async function main() {
  /* 1. Load secret key array from wallet.json */
  const secret = Uint8Array.from(
    JSON.parse(readFileSync("wallet.json", "utf-8"))
  );
  const wallet = Keypair.fromSecretKey(secret);

  /* 2. Choose a cluster (devnet by default) */
  const RPC = process.argv[2] ?? "https://api.devnet.solana.com";
  const connection = new Connection(RPC, "confirmed");

  /* 3. Fetch balance */
  const lamports = await connection.getBalance(wallet.publicKey);
  const sol = lamports / LAMPORTS_PER_SOL;

  /* 4. Output */
  console.log("Public key :", wallet.publicKey.toBase58());
  console.log("SOL balance:", sol.toLocaleString(), "SOL");
  console.log("Lamports   :", lamports.toLocaleString());
}

main().catch((e) => {
  console.error("❌", e);
  process.exit(1);
});
