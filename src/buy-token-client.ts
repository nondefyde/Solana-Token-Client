// buy-token-client.ts
import {
    ComputeBudgetProgram,
    Connection,
    Keypair,
    LAMPORTS_PER_SOL,
    PublicKey,
    SystemProgram,
    Transaction
} from '@solana/web3.js';
import {AnchorProvider, BN, Program, Wallet} from '@coral-xyz/anchor';
import {ASSOCIATED_TOKEN_PROGRAM_ID, getAssociatedTokenAddress, TOKEN_2022_PROGRAM_ID} from '@solana/spl-token';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

// Interface for token purchase result
interface TokenPurchaseResult {
    buyerAddress: string;
    mintAddress: string;
    tokenDataAddress: string;
    solAmount: number;
    signature: string;
}

// Environment variables (set these or pass as parameters)
const TOKEN_MINT_ADDRESS = process.env.TOKEN_MINT_ADDRESS;
const TOKEN_DATA_ADDRESS = process.env.TOKEN_DATA_ADDRESS;
const DEFAULT_SOL_AMOUNT = 0.1; // 0.1 SOL default purchase amount

// Load wallet keypair with proper path resolution
function loadWalletKey(keypairFile: string): Keypair {
    try {
        // Replace ~ with the actual home directory
        const resolvedPath = keypairFile.replace(/^~/, os.homedir());
        console.log(`Loading keypair from: ${resolvedPath}`);

        return Keypair.fromSecretKey(
            new Uint8Array(JSON.parse(fs.readFileSync(resolvedPath).toString()))
        );
    } catch (e) {
        console.error(`Failed to load keypair from ${keypairFile}:`, e);
        process.exit(1);
    }
}

// Setup compute budget for the transaction
function setupComputeBudget() {
    // Increase compute budget for complex operations
    const modifyComputeUnits = ComputeBudgetProgram.setComputeUnitLimit({
        units: 1000000 // 1M compute units
    });

    // Set the compute unit price (prioritization fee)
    const setComputeUnitPrice = ComputeBudgetProgram.setComputeUnitPrice({
        microLamports: 1000 // 0.000001 SOL per compute unit
    });

    return {modifyComputeUnits, setComputeUnitPrice};
}

async function buyToken(
    mintAddress: string = TOKEN_MINT_ADDRESS || '',
    tokenDataAddress: string = TOKEN_DATA_ADDRESS || '',
    solAmount: number = DEFAULT_SOL_AMOUNT,
    keypairPath: string = "~/.config/solana/id.json"
): Promise<TokenPurchaseResult> {
    // Validate inputs
    if (!mintAddress) {
        throw new Error("Missing mint address. Set TOKEN_MINT_ADDRESS env variable or pass as parameter.");
    }
    if (!tokenDataAddress) {
        throw new Error("Missing token data address. Set TOKEN_DATA_ADDRESS env variable or pass as parameter.");
    }

    console.log(`Preparing to buy tokens from mint: ${mintAddress}`);
    console.log(`Token data address: ${tokenDataAddress}`);
    console.log(`Amount to spend: ${solAmount} SOL`);

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

    // Convert string addresses to PublicKeys
    const mintPubkey = new PublicKey(mintAddress);
    const tokenDataPubkey = new PublicKey(tokenDataAddress);

    // Check wallet balance
    const balance = await connection.getBalance(wallet.publicKey);
    console.log(`Wallet balance: ${balance / LAMPORTS_PER_SOL} SOL`);

    // Convert SOL amount to lamports
    const solAmountLamports = new BN(solAmount * LAMPORTS_PER_SOL);

    try {
        // Derive required PDAs
        const [poolPDA] = PublicKey.findProgramAddressSync(
            [Buffer.from("bonding_pool"), mintPubkey.toBuffer()],
            TOKEN_PROGRAM_ID
        );
        console.log(`Pool PDA: ${poolPDA.toString()}`);

        const [treasuryPDA] = PublicKey.findProgramAddressSync(
            [Buffer.from("treasury"), poolPDA.toBuffer()],
            TOKEN_PROGRAM_ID
        );
        console.log(`Treasury PDA: ${treasuryPDA.toString()}`);

        const [configPDA] = PublicKey.findProgramAddressSync(
            [Buffer.from("token_config")],
            TOKEN_PROGRAM_ID
        );
        console.log(`Config PDA: ${configPDA.toString()}`);

        const [adminSettingsPDA] = PublicKey.findProgramAddressSync(
            [Buffer.from("admin")],
            ADMIN_PROGRAM_ID
        );
        console.log(`Admin Settings PDA: ${adminSettingsPDA.toString()}`);

        const [extraAccountMetaListPDA] = PublicKey.findProgramAddressSync(
            [Buffer.from("extra-account-metas"), mintPubkey.toBuffer()],
            HOOK_PROGRAM_ID
        );
        console.log(`Extra Account Meta List PDA: ${extraAccountMetaListPDA.toString()}`);

        // Get token accounts for buyer and pool
        const buyerTokenAccount = await getAssociatedTokenAddress(
            mintPubkey,
            wallet.publicKey,
            false,
            TOKEN_2022_PROGRAM_ID
        );
        console.log(`Buyer Token Account: ${buyerTokenAccount.toString()}`);

        const poolTokenAccount = await getAssociatedTokenAddress(
            mintPubkey,
            poolPDA,
            true,
            TOKEN_2022_PROGRAM_ID
        );
        console.log(`Pool Token Account: ${poolTokenAccount.toString()}`);

        // Get admin settings to find fee and lottery accounts
        console.log("Fetching admin settings...");

        // Fetch the admin settings account
        const adminSettings = await program.account.adminSettings.fetch(adminSettingsPDA);
        const feeAccount = adminSettings.platformAccounts.feeAccount;
        const lotteryAccount = adminSettings.platformAccounts.lotteryAccount;

        console.log(`Using fee account: ${feeAccount.toString()}`);
        console.log(`Using lottery account: ${lotteryAccount.toString()}`);

        // Set up compute budget for the transaction
        const {modifyComputeUnits, setComputeUnitPrice} = setupComputeBudget();

        // Prepare the buy instruction
        console.log("Creating buy instruction...");
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
        console.log(`Purchased tokens from: ${mintPubkey.toString()}`);

        return {
            buyerAddress: wallet.publicKey.toString(),
            mintAddress: mintPubkey.toString(),
            tokenDataAddress: tokenDataPubkey.toString(),
            solAmount: solAmount,
            signature: signature
        };

    } catch (error: any) {
        console.error("Error buying tokens:", error);
        if (error.logs) {
            console.error("Transaction logs:");
            error.logs.forEach((log: string, i: number) => {
                console.error(`${i}: ${log}`);
            });
        }
        throw error;
    }
}

// If this script is run directly, execute the buy function
if (require.main === module) {
    // Get command line arguments
    const args = process.argv.slice(2);
    const mintAddress = args[0] || TOKEN_MINT_ADDRESS;
    const tokenDataAddress = args[1] || TOKEN_DATA_ADDRESS;
    const solAmount = args[2] ? parseFloat(args[2]) : DEFAULT_SOL_AMOUNT;
    const keypairPath = args[3] || "~/.config/solana/id.json";

    buyToken(mintAddress, tokenDataAddress, solAmount, keypairPath)
        .then(result => {
            console.log("Token purchase successful:");
            console.log(JSON.stringify(result, null, 2));
        })
        .catch(err => {
            console.error("Token purchase failed:", err);
            process.exit(1);
        });
}

// Export for use in other scripts
export {buyToken, TokenPurchaseResult, loadWalletKey, setupComputeBudget};