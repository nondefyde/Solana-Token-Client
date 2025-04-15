// token-client.ts
import {
    ComputeBudgetProgram,
    Connection,
    Keypair,
    LAMPORTS_PER_SOL,
    PublicKey,
    SystemProgram,
    Transaction
} from '@solana/web3.js';
import * as crypto from 'crypto';
import {AnchorProvider, BN, Idl, Program, Wallet} from '@coral-xyz/anchor';
import {ASSOCIATED_TOKEN_PROGRAM_ID, getAssociatedTokenAddress, TOKEN_2022_PROGRAM_ID} from '@solana/spl-token';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

// Interface for token creation result
interface TokenCreationResult {
    tokenName: string;
    tokenSymbol: string;
    mint: string;
    tokenData: string;
    creator: string;
    signature: string;
}

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

// Generate a random alphanumeric string
function generateRandomString(length: number): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

async function main(): Promise<TokenCreationResult> {
    // Configure connection to blockchain
    const connection = new Connection("https://api.devnet.solana.com", "confirmed");

    // // Load your wallet keypair
    const walletKeypair = loadWalletKey("~/.config/solana/id.json");
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

    // Load admin program IDL file
    let adminIdl: any;
    try {
        const adminIdlPath = path.resolve("target/idl/admin.json");
        console.log(`Loading admin IDL from: ${adminIdlPath}`);
        adminIdl = JSON.parse(fs.readFileSync(adminIdlPath, "utf8"));
    } catch (error) {
        console.warn("Warning: Unable to load admin IDL, will use fallback methods:", error);
    }

    // Initialize programs
    const program: any = new Program(idl, provider);
    const adminProgram: any = new Program(adminIdl, provider);

// Get token creation parameters with randomized name and symbol
    const tokenName = generateRandomString(8); // e.g., "Abc123XY"
    const tokenSymbol = generateRandomString(4); // e.g., "T1k9"
    const tokenDescription = "My first token created with the client";
    const tokenUri = "https://example.com/token.json";
    const initialPurchaseAmount = new BN(0.5 * LAMPORTS_PER_SOL); // 0.5 SOL
    // const salt = Date.now().toString(); // Use current timestamp as salt for uniqueness
    const salt = "9fbcd71d844dc59e7befe7b18e917dfb"; // Use current timestamp as salt for uniqueness

    console.log("Creating token with the following parameters:");
    console.log(`- Name: ${tokenName}`);
    console.log(`- Symbol: ${tokenSymbol}`);
    console.log(`- Description: ${tokenDescription}`);
    console.log(`- URI: ${tokenUri}`);
    console.log(`- Initial Purchase: ${initialPurchaseAmount.toString()} lamports`);
    console.log(`- Salt: ${salt.toString()}`);

    // Check wallet balance
    const balance = await connection.getBalance(wallet.publicKey);
    console.log(`Wallet balance: ${balance / LAMPORTS_PER_SOL} SOL`);

    try {
        // Derive the PDAs
        const [tokenDataPDA] = PublicKey.findProgramAddressSync(
            [
                Buffer.from("token_data"),
                wallet.publicKey.toBuffer(),
                Buffer.from(salt),
            ],
            TOKEN_PROGRAM_ID
        );
        console.log(`Token Data PDA: ${tokenDataPDA.toString()}`);

        const [mintPDA] = PublicKey.findProgramAddressSync(
            [
                Buffer.from("mint"),
                tokenDataPDA.toBuffer()
            ],
            TOKEN_PROGRAM_ID
        );
        console.log(`Mint PDA: ${mintPDA.toString()}`);

        const [mintAuthorityPDA] = PublicKey.findProgramAddressSync(
            [Buffer.from("mint_authority"), mintPDA.toBuffer()],
            TOKEN_PROGRAM_ID
        );
        console.log(`Mint Authority PDA: ${mintAuthorityPDA.toString()}`);

        const [poolPDA] = PublicKey.findProgramAddressSync(
            [Buffer.from("bonding_pool"), mintPDA.toBuffer()],
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
            [Buffer.from("extra-account-metas"), mintPDA.toBuffer()],
            HOOK_PROGRAM_ID
        );
        console.log(`Extra Account Meta List PDA: ${extraAccountMetaListPDA.toString()}`);

        // Get associated token accounts for creator and pool
        const creatorTokenAccount = await getAssociatedTokenAddress(
            mintPDA,
            wallet.publicKey,
            false,
            TOKEN_2022_PROGRAM_ID
        );
        console.log(`Creator Token Account: ${creatorTokenAccount.toString()}`);

        const poolTokenAccount = await getAssociatedTokenAddress(
            mintPDA,
            poolPDA,
            true,
            TOKEN_2022_PROGRAM_ID
        );
        console.log(`Pool Token Account: ${poolTokenAccount.toString()}`);

        // Get fee and lottery accounts from admin settings
        console.log("Fetching admin settings to get fee and lottery accounts...");
        let feeAccount: PublicKey;
        let lotteryAccount: PublicKey;

        try {
            // Try to fetch the admin settings account
            let adminSettings;
            if (adminProgram) {
                adminSettings = await adminProgram.account.adminSettings.fetch(adminSettingsPDA);
                console.log("Successfully fetched admin settings ");

                // Get platform accounts
                feeAccount = adminSettings.platformAccounts.feeAccount;
                lotteryAccount = adminSettings.platformAccounts.lotteryAccount;

                console.log(`Using fee account from admin settings: ${feeAccount.toString()}`);
                console.log(`Using lottery account from admin settings: ${lotteryAccount.toString()}`);
            } else {
                // Fallback: Fetch raw account data without IDL
                console.log("No admin IDL available, fetching raw account data...");
                const adminAccount = await connection.getAccountInfo(adminSettingsPDA);

                if (!adminAccount) {
                    throw new Error(`Admin settings account not found at ${adminSettingsPDA}`);
                }

                console.log(`Admin account found with ${adminAccount.data.length} bytes of data`);

                // This is a temporary approach - in a production environment you'd want proper deserialization
                // For now, we'll use the wallet address as both to see if it passes your tests
                console.warn("Using wallet address as fee_account and lottery_account for testing.");
                console.warn("You might need to update admin settings to accept these accounts.");

                feeAccount = wallet.publicKey;
                lotteryAccount = wallet.publicKey;
            }
        } catch (error) {
            console.error("Error fetching admin settings:", error);

            // Fallback: Use wallet for testing
            console.warn("FALLBACK: Using wallet address as fee_account and lottery_account");
            feeAccount = wallet.publicKey;
            lotteryAccount = wallet.publicKey;

            console.log(`Fee account (fallback): ${feeAccount.toString()}`);
            console.log(`Lottery account (fallback): ${lotteryAccount.toString()}`);

            console.log("NOTE: You may need to update admin settings to accept these accounts");
            console.log("Continuing with creation attempt anyway...");
        }

        // Set up compute budget for the complex transaction
        const {modifyComputeUnits, setComputeUnitPrice} = setupComputeBudget();

        console.log("Preparing transaction to create token...");
        // Create token instruction
        const createTokenIx = await program.methods
            .create(
                tokenName,
                tokenSymbol,
                tokenDescription,
                tokenUri,
                initialPurchaseAmount,
                salt
            )
            .accounts({
                creator: wallet.publicKey,
                token: tokenDataPDA,
                config: configPDA,
                admin: adminSettingsPDA,
                adminProgram: ADMIN_PROGRAM_ID,
                mint: mintPDA,
                creatorTokenAccount: creatorTokenAccount,
                mintAuthority: mintAuthorityPDA,
                pool: poolPDA,
                treasury: treasuryPDA,
                poolTokenAccount: poolTokenAccount,
                feeAccount: feeAccount,
                lotteryAccount: lotteryAccount,
                tokenProgram: TOKEN_2022_PROGRAM_ID,
                associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
                systemProgram: SystemProgram.programId,
                extraAccountMetaList: extraAccountMetaListPDA,
                hookProgram: HOOK_PROGRAM_ID
            })
            .instruction();

        // Create transaction with compute budget instructions
        const tx = new Transaction()
            .add(modifyComputeUnits)
            .add(setComputeUnitPrice)
            .add(createTokenIx);

        // Send and confirm transaction
        console.log("Sending transaction...");
        try {
            const signature = await provider.sendAndConfirm(tx);
            console.log("Transaction successful!");
            console.log(`Signature: ${signature}`);
            console.log(`Token created: ${mintPDA.toString()}`);

            return {
                tokenName,
                tokenSymbol,
                mint: mintPDA.toString(),
                tokenData: tokenDataPDA.toString(),
                creator: wallet.publicKey.toString(),
                signature
            };
        } catch (error: any) {
            console.error("Transaction failed!");
            if (error.logs) {
                console.error("Transaction logs:");
                error.logs.forEach((log: string, i: number) => {
                    console.error(`${i}: ${log}`);
                });
            }
            throw error;
        }
    } catch (error) {
        console.error("Error creating token:", error);
        throw error;
    }
}

// Run the main function
main()
    .then(result => {
        console.log("Token creation successful:", result);
    })
    .catch(err => {
        console.error("Token creation failed:", err);
        process.exit(1);
    });