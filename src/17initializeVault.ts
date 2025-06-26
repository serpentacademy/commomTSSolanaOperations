import * as anchor from "@coral-xyz/anchor";
import { SystemProgram, PublicKey } from "@solana/web3.js";
import fs from "fs";

// ───────────────────────────────
// 1. Provider & payer
// ───────────────────────────────
const provider = anchor.AnchorProvider.env();
anchor.setProvider(provider);
const payer = (provider.wallet as anchor.Wallet).payer;

// ───────────────────────────────
// 2. Load IDL & program
// ───────────────────────────────
const idl = JSON.parse(
  fs.readFileSync("/Users/serpentacademy/Documents/anchor/anchor-hello/hello_anchor/target/idl/hello_anchor.json", "utf8"),
);
const programId = new PublicKey(
  "8PxQiNSZHSkVmfwyYhCa4Lwxxm8FSfK3SpcSiWGZMq6B",
);
const program = new anchor.Program(idl, programId, provider);

// ───────────────────────────────
// 3. Derive PDA and call method
// ───────────────────────────────
const [vaultPda, bump] = PublicKey.findProgramAddressSync(
  [Buffer.from("vault"), payer.publicKey.toBuffer()],
  programId,
);
// 4. Call initializeVault
async function main() {
  try {
    await program.methods
      .initialize_vault(bump)
      .accounts({
        vaultPda: vaultPda,
        payer: payer.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([payer])
      .rpc();
    console.log("✅ Vault created at", vaultPda.toBase58());
  } catch (error) {
    console.error("Error:", error);
  }
}

main();




console.log("✅ Vault created at", vaultPda.toBase58());

