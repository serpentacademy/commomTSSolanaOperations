import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  SystemProgram,
  clusterApiUrl,
  sendAndConfirmTransaction,
  TransactionInstruction
} from "@solana/web3.js";
import { writeFileSync } from "node:fs";
import path from "node:path";
import {
  SPL_ACCOUNT_COMPRESSION_PROGRAM_ID,
  SPL_NOOP_PROGRAM_ID,
} from "@solana/spl-account-compression";

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
import {TokenProgramVersion, MetadataArgs,TokenStandard,
    PROGRAM_ID as BUBBLEGUM_PROGRAM_ID,
    computeDataHash,
      createMintToCollectionV1Instruction,
      computeCreatorHash,

} from "@metaplex-foundation/mpl-bubblegum";
export interface Collection {
  mint: PublicKey;
  tokenAccount: PublicKey;
  metadataAccount: PublicKey;
  masterEditionAccount: PublicKey;
}
function loadCollection(
  file = "collectionData.json"
): Collection {
  const json = JSON.parse(readFileSync(file, "utf8"));

  return {
    mint: new PublicKey(json.mint),
    tokenAccount: new PublicKey(json.tokenAccount),
    metadataAccount: new PublicKey(json.metadataAccount),
    masterEditionAccount: new PublicKey(json.masterEditionAccount),
  };
}


function loadWalletKey(keypairFile:string): Keypair {
    const fs = require("fs")
    return Keypair.fromSecretKey(
      new Uint8Array(JSON.parse(fs.readFileSync(keypairFile).toString())),
    );
  }

  /*
  Helper function to extract a transaction signature from a failed transaction's error message
*/
export async function extractSignatureFromFailedTransaction(
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
          console.log({ txSignature: failedSig }, "");
          console.log(tx?.meta?.logMessages ?? "No log messages provided by RPC");
          console.log(`==== END LOGS ====\n`);
        });
    else {
      console.log("\n========================================");
      console.log({ txSignature: failedSig });
      console.log("========================================\n");
    }
  }

  // always return the failed signature value
  return failedSig;
}



async function mintCompressedNFT(
  connection: Connection,
  payer: Keypair,
  treeAddress: PublicKey,
  collectionMint: PublicKey,
  collectionMetadata: PublicKey,
  collectionMasterEditionAccount: PublicKey,
  compressedNFTMetadata: MetadataArgs,
  receiverAddress?: PublicKey,
) {
  // derive the tree's authority (PDA), owned by Bubblegum
  const [treeAuthority, _bump] = PublicKey.findProgramAddressSync(
    [treeAddress.toBuffer()],
    BUBBLEGUM_PROGRAM_ID,
  );

  // derive a PDA (owned by Bubblegum) to act as the signer of the compressed minting
  const [bubblegumSigner, _bump2] = PublicKey.findProgramAddressSync(
    // `collection_cpi` is a custom prefix required by the Bubblegum program
    [Buffer.from("collection_cpi", "utf8")],
    BUBBLEGUM_PROGRAM_ID,
  );

  // create an array of instruction, to mint multiple compressed NFTs at once
  const mintIxs: TransactionInstruction[] = [];

  /**
   * correctly format the metadata args for the nft to mint
   * ---
   * note: minting an nft into a collection (via `createMintToCollectionV1Instruction`)
   * will auto verify the collection. But, the `collection.verified` value inside the
   * `metadataArgs` must be set to `false` in order for the instruction to succeed
   */
  const metadataArgs = Object.assign(compressedNFTMetadata, {
    collection: { key: collectionMint, verified: false },
  });

  /**
   * compute the data and creator hash for display in the console
   *
   * note: this is not required to do in order to mint new compressed nfts
   * (since it is performed on chain via the Bubblegum program)
   * this is only for demonstration
   */
  const computedDataHash = new PublicKey(computeDataHash(metadataArgs)).toBase58();
  const computedCreatorHash = new PublicKey(computeCreatorHash(metadataArgs.creators)).toBase58();
  console.log("computedDataHash:", computedDataHash);
  console.log("computedCreatorHash:", computedCreatorHash);

  /*
    Add a single mint to collection instruction 
    ---
    But you could all multiple in the same transaction, as long as your 
    transaction is still within the byte size limits
  */
  mintIxs.push(
    createMintToCollectionV1Instruction(
      {
        payer: payer.publicKey,

        merkleTree: treeAddress,
        treeAuthority,
        treeDelegate: payer.publicKey,

        // set the receiver of the NFT
        leafOwner: receiverAddress || payer.publicKey,
        // set a delegated authority over this NFT
        leafDelegate: payer.publicKey,

        /*
            You can set any delegate address at mint, otherwise should 
            normally be the same as `leafOwner`
            NOTE: the delegate will be auto cleared upon NFT transfer
            ---
            in this case, we are setting the payer as the delegate
          */

        // collection details
        collectionAuthority: payer.publicKey,
        collectionAuthorityRecordPda: BUBBLEGUM_PROGRAM_ID,
        collectionMint: collectionMint,
        collectionMetadata: collectionMetadata,
        editionAccount: collectionMasterEditionAccount,

        // other accounts
        compressionProgram: SPL_ACCOUNT_COMPRESSION_PROGRAM_ID,
        logWrapper: SPL_NOOP_PROGRAM_ID,
        bubblegumSigner: bubblegumSigner,
        tokenMetadataProgram: TOKEN_METADATA_PROGRAM_ID,
      },
      {
        metadataArgs,
      },
    ),
  );

  try {
    // construct the transaction with our instructions, making the `payer` the `feePayer`
    const tx = new Transaction().add(...mintIxs);
    tx.feePayer = payer.publicKey;

    // send the transaction to the cluster
    const txSignature = await sendAndConfirmTransaction(connection, tx, [payer], {
      commitment: "confirmed",
      skipPreflight: true,
    });

    console.log("\nSuccessfully minted the compressed NFT!");
    console.log({ txSignature });

    return txSignature;
  } catch (err) {
    console.error("\nFailed to mint compressed NFT:", err);

    // log a block explorer link for the failed transaction
    await extractSignatureFromFailedTransaction(connection, err);

    throw err;
  }
}



async function main() {
      /* ── payer keypair ─────────────────────────────────────────────── */
  const payer = Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(readFileSync("wallet.json", "utf8")))
  );

  /* ── connection (devnet) ───────────────────────────────────────── */
  const connection = new Connection(clusterApiUrl("devnet"), "confirmed");


  const compressedNFTMetadata: MetadataArgs = {
    name: "Test God #1",
    symbol: "Test God",
    // specific json metadata for each NFT
    uri: "https://arweave.net/dZERmvgaY1swOJkiOzf6UB4JXBIDDRZiXl78h-eZivo",
    creators: [
      {
        address: payer.publicKey,
        verified: false,
        share: 100,
      },
     
    ],
    editionNonce: 0,
    uses: null,
    collection: null,
    primarySaleHappened: false,
    sellerFeeBasisPoints: 0,
    isMutable: false,
    // these values are taken from the Bubblegum package
    tokenProgramVersion: TokenProgramVersion.Original,
    tokenStandard: TokenStandard.NonFungible,
  };
let collection = loadCollection();
  const treeKeypair = loadWalletKey("merkleTreeKeypair.json")

  await mintCompressedNFT(
    connection,
    payer,
    treeKeypair.publicKey,
    collection.mint,
    collection.metadataAccount,
    collection.masterEditionAccount,
    compressedNFTMetadata,
    // mint to this specific wallet (in this case, the tree owner aka `payer`)
    payer.publicKey,
  );


}




main().catch(console.error);
