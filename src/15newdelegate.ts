// delegate-tree.ts -----------------------------------------------------------
// Usage:  npx ts-node delegate-tree.ts <NEW_DELEGATE_PUBKEY> [cluster]
//         cluster = mainnet-beta | devnet | testnet  (default: devnet)
// ---------------------------------------------------------------------------

import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  clusterApiUrl,
} from '@solana/web3.js';
import {
  createSetTreeDelegateInstruction,
  PROGRAM_ID as BUBBLEGUM_PID,
} from '@metaplex-foundation/mpl-bubblegum';
import { readFileSync } from 'fs';

// ----- CLI ------------------------------------------------------------------
if (process.argv.length < 3) {
  console.error('❌  Usage: delegate-tree.ts <NEW_DELEGATE_PUBKEY> [cluster]');
  process.exit(1);
}
const NEW_DELEGATE = new PublicKey(process.argv[2]);
const CLUSTER      = process.argv[3] ?? 'devnet';

async function mainRun() {
    

// ----- 1.  Load creator wallet ---------------------------------------------
const walletJson  = JSON.parse(readFileSync('wallet.json', 'utf8')) as number[];
const creatorKp   = Keypair.fromSecretKey(Uint8Array.from(walletJson));

// ----- 2.  Load Merkle-tree public key --------------------------------------
const rawTree = JSON.parse(readFileSync('merkleTree.json', 'utf8'));
let merkleTree: PublicKey;

if (Array.isArray(rawTree)) {
  // 64-byte secret key → derive pubkey
  merkleTree = Keypair.fromSecretKey(Uint8Array.from(rawTree)).publicKey;
} else if (typeof rawTree === 'string') {
  merkleTree = new PublicKey(rawTree);
} else if ('publicKey' in rawTree) {
  merkleTree = new PublicKey(rawTree.publicKey);
} else {
  throw new Error('Unsupported merkleTree.json format');
}

// PDA that controls the tree (seed = tree public key)
const [treeAuthority] = PublicKey.findProgramAddressSync(
  [merkleTree.toBuffer()],
  BUBBLEGUM_PID
);

// ----- 3.  Build & send the transaction ------------------------------------
const connection = new Connection(clusterApiUrl("devnet"), 'confirmed');

const ix = createSetTreeDelegateInstruction({
  merkleTree,
  treeAuthority,
  treeCreator   : creatorKp.publicKey,
  newTreeDelegate: NEW_DELEGATE,
});

const tx = new Transaction().add(ix);
tx.feePayer        = creatorKp.publicKey;
tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

tx.sign(creatorKp);
const sig = await connection.sendRawTransaction(tx.serialize(), {
  skipPreflight: false,
});
await connection.confirmTransaction(sig, 'confirmed');

console.log(
  `✅ Delegate set!\n   Tree:      ${merkleTree.toBase58()}\n   New auth:  ${NEW_DELEGATE.toBase58()}\n   Tx:        https://explorer.solana.com/tx/${sig}?cluster=${CLUSTER}`
);
}
mainRun();