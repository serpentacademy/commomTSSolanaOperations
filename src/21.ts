import * as anchor from "@coral-xyz/anchor";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import {
  getAssociatedTokenAddressSync,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";

/* ── 0. constants ─────────────────────────────────────────── */
const PROGRAM_ID = new PublicKey(
  "5G1DhVdp9XFAzSHadnpEDmeE8KeEjv2q9vjndPX41ifN"
);

const VAULT_TA = new PublicKey(
  "8rLKLZpiHv4qBvGeoxR5fD1UKfzY7ML6ebDENXRPUv2j"
);

const PAYOUT_WALLET = new PublicKey(
  "J8W7cSvV3iEcBFVuFPMHPHPbo7bHCrhRymyjsQ7eEcEP"
);

const MINT_ID = new PublicKey(
  "HCfyWwHhWGVLYQE93sF7Amweh218Fs63iw8xMRrMY8zs"
);

/* ── 1. provider / program ───────────────────────────────── */
const provider = anchor.AnchorProvider.env();
anchor.setProvider(provider);

const idl = require("/Users/serpentacademy/Documents/anchor/hello_anchor/target/idl/token_sale.json");
const program = new anchor.Program(idl, provider);

/* ── 2. derive the PDA & buyer ATA in the client ─────────── */
const [tokenAuth] = PublicKey.findProgramAddressSync(
  [Buffer.from("token-auth")],
  PROGRAM_ID
);

const buyer = provider.wallet.publicKey;

const buyerAta = getAssociatedTokenAddressSync(MINT_ID, buyer);

/* ── 3. build & send the tx  ─────────────────────────────── */
(async () => {
  // Disable auto-population of PDAs if necessary

  const sig = await program.methods
    .swap()
    .accounts({
      buyer,
      payout: PAYOUT_WALLET,
      tokenAuth,
      vault: VAULT_TA,
      buyerAta,
      mint: MINT_ID,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    })
    .rpc();

  console.log("✅ swap tx:", sig);
})();