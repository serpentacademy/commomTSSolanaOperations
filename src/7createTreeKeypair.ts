import { Keypair } from "@solana/web3.js";
import { writeFileSync } from "fs";

/**
 * Create a new keypair for a Merkle Tree and save it to a JSON file.
 */
function main() {
  // 1. Generate a fresh Keypair
  const merkleTreeKeypair = Keypair.generate();

  // 2. Convert the secret key (Uint8Array) to a normal array
  const secretKeyArray = Array.from(merkleTreeKeypair.secretKey);

  // 3. Save the array to a JSON file
  const filePath = "./merkleTreeKeypair.json";
  writeFileSync(filePath, JSON.stringify(secretKeyArray), "utf-8");

  console.log(`Merkle Tree Keypair saved to "${filePath}"`);
  console.log("Public Key:", merkleTreeKeypair.publicKey.toBase58());
}

main();