import { Connection, Keypair, PublicKey, Transaction } from '@solana/web3.js';
import { readFileSync, writeFileSync } from 'fs';
import {
  createAllocTreeIx,
  SPL_ACCOUNT_COMPRESSION_PROGRAM_ID,
} from '@solana/spl-account-compression';
import {
  PROGRAM_ID as BUBBLEGUM_PROGRAM_ID,
  createCreateTreeInstruction
} from '@metaplex-foundation/mpl-bubblegum';





//maxDepth: 5, maxBufferSize: 8, canopy: 3, numberOfNfts: 32, rent: 0.01709376

async function main() {
  // 1. Read your payer keypair (wallet) from a local JSON file
  //    This file must contain a raw array of 64 numbers representing the secret key.
  const secretKeyArray = JSON.parse(readFileSync('wallet.json', 'utf-8'));
  const payer = Keypair.fromSecretKey(Uint8Array.from(secretKeyArray));

  // 2. Connect to Solana (Devnet example)
  const connection = new Connection('https://api.mainnet-beta.solana.com', 'confirmed');

  // 3. Define some parameters for your Merkle Tree
  //    Adjust these if you need a different size (larger depth => more leaves).
  const maxDepth = 5;       // 2^14 leaves = 16384 (example)
  const maxBufferSize = 8;  // Typically 64 is enough for a small tree

  // 4. Generate a fresh Keypair for your Merkle Tree's PDA
  //    This key will hold the compressed data for the tree.
  const secretKeyBytes = JSON.parse(readFileSync("./merkleTreeKeypair.json", "utf-8"));
const merkleTreeKeypair = Keypair.fromSecretKey(Uint8Array.from(secretKeyBytes));




  // 5. Allocate the Merkle Tree account on-chain
  const allocIx = await createAllocTreeIx(
    connection,
    
    merkleTreeKeypair.publicKey,
    payer.publicKey,
    {maxDepth: 5, maxBufferSize: 8},
  4
  );

  // 6. Find the tree authority (PDA) for the Bubblegum program
  const [treeAuthority] = PublicKey.findProgramAddressSync(
    [merkleTreeKeypair.publicKey.toBuffer()],
    BUBBLEGUM_PROGRAM_ID
  );

  // 7. Create the instruction to initialize (create) the tree
  const createTreeIx = createCreateTreeInstruction(
    {
      merkleTree: merkleTreeKeypair.publicKey,
      treeAuthority,
      payer: payer.publicKey,
      treeCreator: payer.publicKey,
      compressionProgram: SPL_ACCOUNT_COMPRESSION_PROGRAM_ID,
      // The Bubblegum program often logs via the Noop program (logWrapper).
      logWrapper: new PublicKey('noopb9bkMVfRPU8AsbpTUg8AQkHtKwMYZiFUjNRtMmV'),
      systemProgram: PublicKey.default,
    },
    {
      maxDepth,
      maxBufferSize,
      public: false, // Set to true if you want a 'public' tree
      // canopyDepth: 0, // (Optional) reduce stored proof data
    }
  );

  // 8. Build and sign the transaction
  const transaction = new Transaction().add(allocIx).add(createTreeIx);
  transaction.feePayer = payer.publicKey;
  const { blockhash } = await connection.getLatestBlockhash();
  transaction.recentBlockhash = blockhash;

  // IMPORTANT: You must sign with both the payer and the Merkle Tree Keypair
  transaction.sign(payer, merkleTreeKeypair);

  // 9. Send and confirm the transaction
  const txSignature = await connection.sendRawTransaction(transaction.serialize());
  console.log('Transaction Signature:', txSignature);

  const confirmation = await connection.confirmTransaction(txSignature, 'confirmed');
  console.log('Transaction Confirmation:', confirmation);

  // 10. Done! Your new tree's public key is:
  console.log('Merkle Tree created at:', merkleTreeKeypair.publicKey.toBase58());
}

main().catch((error) => {
  console.error(error);
});