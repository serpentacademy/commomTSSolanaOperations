import * as anchor from "@coral-xyz/anchor";
import { clusterApiUrl, PublicKey } from "@solana/web3.js";
import fs from "fs";
import path from "path";


/* ── 1. Provider (wallet = ~/.config/solana/id.json) ───────── */
const provider = anchor.AnchorProvider.env();
anchor.setProvider(provider);
const payer = (provider.wallet as anchor.Wallet).payer;


const connection = new anchor.web3.Connection(
  clusterApiUrl("devnet"),       // change cluster if you deployed elsewhere
  "confirmed",
);

anchor.setProvider(provider);

/* ── 2. Load IDL & construct Program object ───────────────── */
const idl = JSON.parse(
  fs.readFileSync("/Users/serpentacademy/Documents/anchor/hello_anchor/target/idl/hello_anchor.json", "utf8"),
);

const PROGRAM_ID = new PublicKey(
  "ktnDVvgC8yhd2QqU32shpSA3dRQCYjUJBM4wbUVTycD",      // same as declare_id!
);

const program = new anchor.Program(idl, PROGRAM_ID, provider);

/* ── 3. Invoke `initialize` (no accounts, no args) ────────── */
(async () => {
  const sig = await program.methods
    .initialize()   // ← exactly the name in the IDL
    .rpc();         // no .accounts() block needed

  console.log("✅ initialize tx:", sig);
})();
