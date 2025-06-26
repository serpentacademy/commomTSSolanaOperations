import { Connection, clusterApiUrl, PublicKey } from "@solana/web3.js";

const conn  = new Connection(clusterApiUrl("devnet"));
const MINT  = new PublicKey("HCfyWwHhWGVLYQE93sF7Amweh218Fs63iw8xMRrMY8zs");

(async () => {
  const info = await conn.getAccountInfo(MINT);
  console.log("owner =", info?.owner.toBase58());
})();


//TokenkegQfeZyi…VQ5DA	Classic SPL-Token (2018)
//TokenzQdYdYkB…jWgM9	token-2022 experimental

