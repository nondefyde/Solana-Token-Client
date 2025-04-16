// dex-migration-focused.ts
import {Connection, LAMPORTS_PER_SOL, PublicKey, SystemProgram, Transaction} from '@solana/web3.js';
import {AnchorProvider, BN, Program, Wallet} from '@coral-xyz/anchor';
import {ASSOCIATED_TOKEN_PROGRAM_ID, getAssociatedTokenAddress, TOKEN_2022_PROGRAM_ID} from '@solana/spl-token';
import * as fs from 'fs';
import * as path from 'path';
import {loadWalletKey, setupComputeBudget} from './buy-token-client';
import {createToken} from './integrated-token-flow';

/**
 * Direct DEX migration function - streamlined process to quickly trigger migration
 */
async function directDexMigration(
    mintAddress?: string,
    tokenDataAddress?: string,
    keypairPath: string = "~/.config/solana/id.json"
): Promise<void> {
    console.log("=== DIRECT DEX MIGRATION PROCESS ===");

    // Configure connection to blockchain
    const connection = new Connection("https://api.devnet.solana.com", "confirmed");

    // Load wallet keypair
    const walletKeypair = loadWalletKey(keypairPath);
    console.log(`Using wallet address: ${walletKeypair.publicKey.toString()}`);

    // Configure anchor provider
    const wallet = new Wallet(walletKeypair);
    const provider = new AnchorProvider(connection, wallet, {commitment: "confirmed"});

    // Program IDs - these match the values in the Anchor.toml file
    const TOKEN_PROGRAM_ID = new PublicKey("26x3ZYihWe241VEiaXFUnyNgVVFix3tqXkugoygiEp1S");
    const HOOK_PROGRAM_ID = new PublicKey("oGb7c7Y1fYcsGznCQLU82ReUGk2ZrkSjuEH2LJkFJPH");
    const ADMIN_PROGRAM_ID = new PublicKey("HpB6fKQKWVHxpw2ApduNeJfqdVjTS4Yk4mUM8stwvXdf");

    // Load token program IDL file
    let idl: any;
    try {
        const idlPath = path.resolve("target/idl/token.json");
        console.log(`Loading token IDL from: ${idlPath}`);
        idl = JSON.parse(fs.readFileSync(idlPath, "utf8"));
    } catch (error) {
        console.error("Error loading token IDL:", error);
        throw error;
    }

    // Initialize program
    const program: any = new Program(idl, provider);

    try {
        // Step 1: If no mint address provided, create a new token
        if (!mintAddress || !tokenDataAddress) {
            console.log("\n=== CREATING NEW TOKEN ===");
            const tokenResult = await createToken(keypairPath);
            console.log("Token creation successful!");
            console.log(`Token Name: ${tokenResult.tokenName}`);
            console.log(`Token Symbol: ${tokenResult.tokenSymbol}`);
            console.log(`Mint Address: ${tokenResult.mint}`);
            console.log(`Token Data Address: ${tokenResult.tokenData}`);

            mintAddress = tokenResult.mint;
            tokenDataAddress = tokenResult.tokenData;

            // Wait for blockchain to settle
            console.log("Waiting for blockchain to settle...");
            await new Promise(resolve => setTimeout(resolve, 2000));
        }

        const mintPubkey = new PublicKey(mintAddress);
        const tokenDataPubkey = new PublicKey(tokenDataAddress);

        // Step 2: Get pool info to determine how much SOL is needed
        const [poolPDA] = PublicKey.findProgramAddressSync(
            [Buffer.from("bonding_pool"), mintPubkey.toBuffer()],
            TOKEN_PROGRAM_ID
        );
        console.log(`Pool PDA: ${poolPDA.toString()}`);

        const poolBefore = await program.account.pool.fetch(poolPDA);

        // If DEX already initialized, exit early
        if (poolBefore.dexInitialized) {
            console.log("\n⚠️ DEX ALREADY INITIALIZED FOR THIS TOKEN ⚠️");
            return;
        }

        console.log("\n=== POOL STATE BEFORE MIGRATION ===");
        console.log(`Virtual SOL: ${poolBefore.virtualSol / LAMPORTS_PER_SOL} SOL`);
        console.log(`SOL Reserve: ${poolBefore.solReserve / LAMPORTS_PER_SOL} SOL`);
        console.log(`Tokens in Pool: ${poolBefore.tokensInPool}`);
        console.log(`Market Cap Threshold: ${poolBefore.marketCapThreshold / LAMPORTS_PER_SOL} SOL`);
        console.log(`DEX Initialized: ${poolBefore.dexInitialized}`);

        // Calculate current market cap
        const totalSol = poolBefore.virtualSol + poolBefore.solReserve;
        const currentMarketCap = totalSol * 2; // Market cap is 2x the total SOL
        console.log(`Current Market Cap: ${currentMarketCap / LAMPORTS_PER_SOL} SOL`);

        // Calculate how much more SOL we need to buy to reach the threshold
        const remainingToThreshold = Math.max(0, poolBefore.marketCapThreshold - currentMarketCap);
        console.log(`Remaining to threshold: ${remainingToThreshold / LAMPORTS_PER_SOL} SOL`);

        // Calculate buy amount with safety margin (50% more than needed)
        const solNeededForPool = (remainingToThreshold / 2) * 1.5;
        // Account for fee (assume 2% fee)
        const buyAmountWithFee = solNeededForPool / 0.98;
        // Round up to nearest 0.1 SOL
        const solAmount = Math.max(0.5, Math.ceil(buyAmountWithFee / LAMPORTS_PER_SOL * 10) / 10);

        // Step 3: Set up accounts for the buy transaction
        console.log(`\n=== BUYING ${solAmount} SOL OF TOKENS TO TRIGGER MIGRATION ===`);

        const [treasuryPDA] = PublicKey.findProgramAddressSync(
            [Buffer.from("treasury"), poolPDA.toBuffer()],
            TOKEN_PROGRAM_ID
        );

        const [configPDA] = PublicKey.findProgramAddressSync(
            [Buffer.from("token_config")],
            TOKEN_PROGRAM_ID
        );

        const [adminSettingsPDA] = PublicKey.findProgramAddressSync(
            [Buffer.from("admin")],
            ADMIN_PROGRAM_ID
        );

        const [extraAccountMetaListPDA] = PublicKey.findProgramAddressSync(
            [Buffer.from("extra-account-metas"), mintPubkey.toBuffer()],
            HOOK_PROGRAM_ID
        );

        // Get token accounts for buyer and pool
        const buyerTokenAccount = await getAssociatedTokenAddress(
            mintPubkey,
            wallet.publicKey,
            false,
            TOKEN_2022_PROGRAM_ID
        );

        const poolTokenAccount = await getAssociatedTokenAddress(
            mintPubkey,
            poolPDA,
            true,
            TOKEN_2022_PROGRAM_ID
        );

        // Get admin settings to find fee and lottery accounts
        const adminSettings = await program.account.adminSettings.fetch(adminSettingsPDA);
        const feeAccount = adminSettings.platformAccounts.feeAccount;
        const lotteryAccount = adminSettings.platformAccounts.lotteryAccount;

        // Step 4: Execute buy transaction
        const solAmountLamports = new BN(solAmount * LAMPORTS_PER_SOL);

        // Set up compute budget for the transaction
        const {modifyComputeUnits, setComputeUnitPrice} = setupComputeBudget();

        // Prepare the buy instruction
        const buyIx = await program.methods
            .buy(solAmountLamports)
            .accounts({
                buyer: wallet.publicKey,
                token: tokenDataPubkey,
                config: configPDA,
                admin: adminSettingsPDA,
                adminProgram: ADMIN_PROGRAM_ID,
                mint: mintPubkey,
                pool: poolPDA,
                treasury: treasuryPDA,
                poolTokenAccount: poolTokenAccount,
                buyerTokenAccount: buyerTokenAccount,
                feeAccount: feeAccount,
                lotteryAccount: lotteryAccount,
                extraAccountMetaList: extraAccountMetaListPDA,
                tokenProgram: TOKEN_2022_PROGRAM_ID,
                associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
                systemProgram: SystemProgram.programId,
                hookProgram: HOOK_PROGRAM_ID,
            })
            .instruction();

        // Create and sign transaction
        const tx = new Transaction()
            .add(modifyComputeUnits)
            .add(setComputeUnitPrice)
            .add(buyIx);

        console.log("Sending transaction...");
        const signature = await provider.sendAndConfirm(tx);
        console.log("Transaction successful!");
        console.log(`Signature: ${signature}`);

        // Step 5: Check if DEX migration was triggered
        console.log("\n=== CHECKING IF DEX MIGRATION WAS TRIGGERED ===");

        // Wait a moment for the transaction to be fully processed
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Get updated pool info
        const poolAfter = await program.account.pool.fetch(poolPDA);
        console.log("\n=== POOL STATE AFTER PURCHASE ===");
        console.log(`Virtual SOL: ${poolAfter.virtualSol / LAMPORTS_PER_SOL} SOL`);
        console.log(`SOL Reserve: ${poolAfter.solReserve / LAMPORTS_PER_SOL} SOL`);
        console.log(`Tokens in Pool: ${poolAfter.tokensInPool}`);
        console.log(`DEX Initialized: ${poolAfter.dexInitialized}`);

        // Calculate new market cap
        const newTotalSol = poolAfter.virtualSol + poolAfter.solReserve;
        const newMarketCap = newTotalSol * 2;
        console.log(`New Market Cap: ${newMarketCap / LAMPORTS_PER_SOL} SOL`);

        if (poolAfter.dexInitialized) {
            console.log("\n🎉 DEX MIGRATION SUCCESSFUL! 🎉");
            console.log(`Token is now transferable and ready for DEX trading`);
        } else {
            console.log("\n⚠️ DEX MIGRATION NOT TRIGGERED YET ⚠️");
            console.log("You may need to run this script again with a larger purchase amount");

            const additionalNeeded = (poolAfter.marketCapThreshold - newMarketCap) / LAMPORTS_PER_SOL;
            if (additionalNeeded > 0) {
                console.log(`Additional SOL needed: approximately ${additionalNeeded.toFixed(2)} SOL`);
            } else {
                console.log("Market cap threshold has been reached but migration was not triggered.");
                console.log("This might be due to a program issue or race condition.");
            }
        }

    } catch (error: any) {
        console.error("Error during DEX migration process:", error);
        if (error.logs) {
            console.error("\nTransaction logs:");
            error.logs.forEach((log: string, i: number) => {
                console.error(`${i}: ${log}`);
            });
        }
        throw error;
    }
}

// If this script is run directly, execute it with parameters
if (require.main === module) {
    // Get command line arguments
    const args = process.argv.slice(2);
    const mintAddress = args[0];
    const tokenDataAddress = args[1];
    const keypairPath = args[2] || "~/.config/solana/id.json";

    directDexMigration(mintAddress, tokenDataAddress, keypairPath)
        .then(() => {
            console.log("DEX migration process completed");
            process.exit(0);
        })
        .catch(err => {
            console.error("DEX migration process failed:", err);
            process.exit(1);
        });
}

// Export the function for use in other scripts
export {directDexMigration};