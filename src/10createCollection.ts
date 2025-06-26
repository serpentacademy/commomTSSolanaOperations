import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  SystemProgram,
  clusterApiUrl,
  sendAndConfirmTransaction
} from "@solana/web3.js";
import { writeFileSync } from "node:fs";
import path from "node:path";

import {
  createCreateMetadataAccountV3Instruction,
  createCreateMasterEditionV3Instruction,
  PROGRAM_ID as TOKEN_METADATA_PROGRAM_ID,
  CreateMetadataAccountArgsV3,
  createSetCollectionSizeInstruction
} from "@metaplex-foundation/mpl-token-metadata";
import {
  createInitializeMintInstruction,
  TOKEN_PROGRAM_ID,
  createAccount,
  createMint,
  mintTo
} from "@solana/spl-token";
import { readFileSync } from "node:fs";


type MaybePubkey = PublicKey | string;

   interface CollectionData {
  mint: MaybePubkey;
  tokenAccount: MaybePubkey;
  metadataAccount: MaybePubkey;
  masterEditionAccount: MaybePubkey;
}

function saveCollectionData(
  data: CollectionData,
  filePath: string = path.resolve("collectionDataMainnet.json")
) {
  // convert any PublicKey objects to base-58 strings
  const out = Object.fromEntries(
    Object.entries(data).map(([k, v]) => [k, typeof v === "string" ? v : v.toBase58()])
  );

  writeFileSync(filePath, JSON.stringify(out, null, 2));
  console.log(`✅  Collection data written to ${filePath}`);
}

 async function createCollection(
  connection: Connection,
  payer: Keypair,
  metadataV3: CreateMetadataAccountArgsV3,
) {
  // create and initialize the SPL token mint
  console.log("Creating the collection's mint...");
  const mint = await createMint(
    connection,
    payer,
    // mint authority
    payer.publicKey,
    // freeze authority
    payer.publicKey,
    // decimals - use `0` for NFTs since they are non-fungible
    0,
  );
  console.log("Mint address:", mint.toBase58());

  // create the token account
  console.log("Creating a token account...");
  const tokenAccount = await createAccount(
    connection,
    payer,
    mint,
    payer.publicKey,
    // undefined, undefined,
  );
 console.log("Token account:", tokenAccount.toBase58());
  // mint 1 token ()
  console.log("Minting 1 token for the collection...");
  const mintSig = await mintTo(
    connection,
    payer,
    mint,
    tokenAccount,
    payer,
    // mint exactly 1 token
    1,
    // no `multiSigners`
    [],
    undefined,
    TOKEN_PROGRAM_ID,
  );
  //console.log(explorerURL({ txSignature: mintSig }));

  // derive the PDA for the metadata account
  const [metadataAccount, _bump] = PublicKey.findProgramAddressSync(
    [Buffer.from("metadata", "utf8"), TOKEN_METADATA_PROGRAM_ID.toBuffer(), mint.toBuffer()],
    TOKEN_METADATA_PROGRAM_ID,
  );
  console.log("Metadata account:", metadataAccount.toBase58());

  // create an instruction to create the metadata account
  const createMetadataIx = createCreateMetadataAccountV3Instruction(
    {
      metadata: metadataAccount,
      mint: mint,
      mintAuthority: payer.publicKey,
      payer: payer.publicKey,
      updateAuthority: payer.publicKey,
    },
    {
      createMetadataAccountArgsV3: metadataV3,
    },
  );




  // derive the PDA for the metadata account
  const [masterEditionAccount, _bump2] = PublicKey.findProgramAddressSync(
    [
      Buffer.from("metadata", "utf8"),
      TOKEN_METADATA_PROGRAM_ID.toBuffer(),
      mint.toBuffer(),
      Buffer.from("edition", "utf8"),
    ],
    TOKEN_METADATA_PROGRAM_ID,
  );
  console.log("Master edition account:", masterEditionAccount.toBase58());

  // create an instruction to create the metadata account
  const createMasterEditionIx = createCreateMasterEditionV3Instruction(
    {
      edition: masterEditionAccount,
      mint: mint,
      mintAuthority: payer.publicKey,
      payer: payer.publicKey,
      updateAuthority: payer.publicKey,
      metadata: metadataAccount,
    },
    {
      createMasterEditionArgs: {
        maxSupply: 0,
      },
    },
  );

  // create the collection size instruction
  const collectionSizeIX = createSetCollectionSizeInstruction(
    {
      collectionMetadata: metadataAccount,
      collectionAuthority: payer.publicKey,
      collectionMint: mint,
    },
    {
      setCollectionSizeArgs: { size: 50 },
    },
  );

  try {
    // construct the transaction with our instructions, making the `payer` the `feePayer`
    const tx = new Transaction()
      .add(createMetadataIx)
      .add(createMasterEditionIx)
      .add(collectionSizeIX);
    tx.feePayer = payer.publicKey;

    // send the transaction to the cluster
    const txSignature = await sendAndConfirmTransaction(connection, tx, [payer], {
      commitment: "confirmed",
      skipPreflight: true,
    });

    console.log("\nCollection successfully created!");
    console.log({ txSignature });
  } catch (err) {
    console.error("\nFailed to create collection:", err);

    // log a block explorer link for the failed transaction
    await extractSignatureFromFailedTransaction(connection, err);

    throw err;
  }


let collectionData:CollectionData = {mint,tokenAccount,metadataAccount, masterEditionAccount};
saveCollectionData(collectionData);
  // return all the accounts
  return { mint, tokenAccount, metadataAccount, masterEditionAccount };
}


async function extractSignatureFromFailedTransaction(
  connection: Connection,
  err: any,
  fetchLogs?: boolean,
) {
  if (err?.signature) return err.signature;

  // extract the failed transaction's signature
  const failedSig = new RegExp(/^((.*)?Error: )?(Transaction|Signature) ([A-Z0-9]{32,}) /gim).exec(
    err?.message?.toString(),
  )?.[4];

  // ensure a signature was found
  if (failedSig) {
    // when desired, attempt to fetch the program logs from the cluster
    if (fetchLogs)
      await connection
        .getTransaction(failedSig, {
          maxSupportedTransactionVersion: 0,
        })
        .then(tx => {
          console.log(`\n==== Transaction logs for ${failedSig} ====`);
          console.log(explorerURL({ txSignature: failedSig }), "");
          console.log(tx?.meta?.logMessages ?? "No log messages provided by RPC");
          console.log(`==== END LOGS ====\n`);
        });
    else {
      console.log("\n========================================");
      console.log(explorerURL({ txSignature: failedSig }));
      console.log("========================================\n");
    }
  }

  // always return the failed signature value
  return failedSig;
}


export function explorerURL({
  address,
  txSignature,
  cluster,
}: {
  address?: string;
  txSignature?: string;
  cluster?: "devnet" | "testnet" | "mainnet" | "mainnet-beta";
}) {
  let baseUrl: string;
  //
  if (address) baseUrl = `https://explorer.solana.com/address/${address}`;
  else if (txSignature) baseUrl = `https://explorer.solana.com/tx/${txSignature}`;
  else return "[unknown]";

  // auto append the desired search params
  const url = new URL(baseUrl);
  url.searchParams.append("cluster", cluster || "mainnet-beta");
  return url.toString() + "\n";
}
async function main() {
  /* ── payer keypair ─────────────────────────────────────────────── */
  const payer = Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(readFileSync("wallet.json", "utf8")))
  );

  /* ── connection (devnet) ───────────────────────────────────────── */
  const connection = new Connection(clusterApiUrl("mainnet-beta"), "confirmed");

  /* ── fresh mint for the collection NFT ─────────────────────────── */
  const collectionMint = Keypair.generate();

 

  const [collectionMetadataAccount] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("metadata", "utf8"),
        TOKEN_METADATA_PROGRAM_ID.toBuffer(),
        collectionMint.publicKey.toBuffer(),
      ],
      TOKEN_METADATA_PROGRAM_ID
    );


  const [masterEditionPDA] = PublicKey.findProgramAddressSync(
    [
      Buffer.from("metadata"),
      TOKEN_METADATA_PROGRAM_ID.toBuffer(),
      collectionMint.publicKey.toBuffer(),
      Buffer.from("edition"),
    ],
    TOKEN_METADATA_PROGRAM_ID
  );



    const [collectionEditionAccount] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("metadata", "utf8"),
        TOKEN_METADATA_PROGRAM_ID.toBuffer(),
        collectionMint.publicKey.toBuffer(),
        Buffer.from("edition", "utf8"),
      ],
      TOKEN_METADATA_PROGRAM_ID
    );

  const collectionMetadataV3: CreateMetadataAccountArgsV3 = {
    data: {
      name: "Indie Wild Cats by Lux",
      symbol: "IWCL",
      // specific json metadata for the collection
      uri: "http://arweave.net/2-Po12hYkdeA800tLKxcl_oRIlfxitNDIKc8m4yXRr0",
      sellerFeeBasisPoints: 100,
      creators: [
        {
          address: payer.publicKey,
          verified: false,
          share: 100,
        },
      ],
      collection: null,
      uses: null,
    },
    isMutable: false,
    collectionDetails: null,
  };
const collection = await createCollection(connection, payer, collectionMetadataV3);    



}

main().catch(console.error);
