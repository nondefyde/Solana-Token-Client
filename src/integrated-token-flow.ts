// integrated-token-flow.ts
import {Connection, LAMPORTS_PER_SOL, PublicKey, SystemProgram, Transaction} from '@solana/web3.js';
import {AnchorProvider, BN, Program, Wallet} from '@coral-xyz/anchor';
import {ASSOCIATED_TOKEN_PROGRAM_ID, getAssociatedTokenAddress, TOKEN_2022_PROGRAM_ID} from '@solana/spl-token';
import * as fs from 'fs';
import * as path from 'path';
import {buyToken, loadWalletKey, setupComputeBudget} from './buy-token-client';
import {sellToken} from './sell-token-client';

// Helper function to generate a random alphanumeric string
function generateRandomString(length: number): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

function getRandomBetweenSell() {
    const min = 500;
    const max = 500000000;
    return Math.floor(Math.random() * (max - min + 1)) + min;
}


function getRandomBetweenBuy() {
    const min = 0.01;
    const max = 0.1;
    const random = Math.random() * (max - min) + min;
    return parseFloat(random.toFixed(2));
}


// Utility function to get token balance
async function getTokenBalance(connection: Connection, owner: PublicKey, mint: PublicKey): Promise<number | null> {
    try {
        const tokenAccount = await getAssociatedTokenAddress(
            mint,
            owner,
            false,
            TOKEN_2022_PROGRAM_ID
        );

        const tokenBalance = await connection.getTokenAccountBalance(tokenAccount);
        return tokenBalance.value.uiAmount;
    } catch (error) {
        console.error(`Error fetching token balance: ${error}`);
        return null;
    }
}

// Utility function to get SOL balance
async function getSOLBalance(connection: Connection, address: PublicKey): Promise<number> {
    const balance = await connection.getBalance(address);
    return balance / LAMPORTS_PER_SOL;
}

async function getSalt(data: any) {
    try {
        const url: string = process.env.API_URL ?? "http://localhost:4000/v1"
        console.log('URL - ', url);
        const response = await fetch(`${url}/tokens/init`, {
            method: 'POST',
            headers: {
                'x-api-key': 'SlashApiKey',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });

        const result: any = await response.json();

        if (result?.meta?.success && result?.data?.salt) {
            return result.data.salt;
        }

        return null;
    } catch (err) {
        console.error('Error fetching salt:', err);
        return null;
    }
}


// Interface for token creation result
interface TokenCreationResult {
    tokenName: string;
    tokenSymbol: string;
    mint: string;
    tokenData: string;
    creator: string;
    signature: string;
}

// Create a new token
async function createToken(keypairPath: string = "~/.config/solana/id.json"): Promise<TokenCreationResult> {
    console.log("=== CREATING NEW TOKEN ===");

    // Configure connection to blockchain
    const connection = new Connection("https://api.devnet.solana.com", "confirmed");

    // Load wallet keypair
    const walletKeypair = loadWalletKey(keypairPath);
    console.log(`Using wallet address: ${walletKeypair.publicKey.toString()}`);

    // Configure anchor provider
    const wallet = new Wallet(walletKeypair);

    // Program IDs
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

    // Initialize the AnchorProvider
    const provider = new AnchorProvider(connection, wallet, {commitment: "confirmed"});

    // Get token creation parameters with randomized name and symbol
    const tokenName = generateRandomString(8); // e.g., "Abc123XY"
    const tokenSymbol = generateRandomString(4).toUpperCase(); // e.g., "T1K9"
    const tokenDescription = "Test token created with integrated workflow";
    const tokenUri = "https://example.com/token.json";
    const initialPurchaseAmount = new BN(0.5 * LAMPORTS_PER_SOL); // 0.5 SOL
    const salt = await getSalt({
        name: tokenName,
        symbol: tokenSymbol,
        description: tokenDescription,
        uri: tokenUri,
        purchaseAmount: initialPurchaseAmount.toString(),
        socials: {
            facebook: 'https://placehold.co/600x400'
        }
    }) || Date.now().toString(); // Use current timestamp as salt for uniqueness

    console.log("Creating token with the following parameters:");
    console.log(`- Name: ${tokenName}`);
    console.log(`- Symbol: ${tokenSymbol}`);
    console.log(`- Description: ${tokenDescription}`);
    console.log(`- URI: ${tokenUri}`);
    console.log(`- Initial Purchase: ${initialPurchaseAmount.toString()} lamports`);
    console.log(`- Salt: ${salt}`);

    // Check wallet balance
    const balance = await connection.getBalance(wallet.publicKey);
    console.log(`Wallet balance: ${balance / LAMPORTS_PER_SOL} SOL`);

    // Initialize the token program
    const program: any = new Program(idl, provider);

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

        const adminProgram: any = adminIdl ? new Program(adminIdl, provider) : null;

        let feeAccount: PublicKey;
        let lotteryAccount: PublicKey;

        try {
            // Try to fetch the admin settings account
            let adminSettings;
            if (adminProgram) {
                adminSettings = await adminProgram.account.adminSettings.fetch(adminSettingsPDA);
                console.log("Successfully fetched admin settings");

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

                // This is a temporary fallback approach
                console.warn("Using wallet address as fee_account and lottery_account for testing.");
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
        console.error("Error creating token:", error);
        if (error.logs) {
            console.error("Transaction logs:");
            error.logs.forEach((log: string, i: number) => {
                console.error(`${i}: ${log}`);
            });
        }
        throw error;
    }
}

// Run the complete workflow: create, buy, and sell tokens
async function completeTokenWorkflow(keypairPath: string = "~/.config/solana/id.json") {
    console.log("Starting complete token workflow: Create -> Buy -> Sell");

    // Configure connection to blockchain
    const connection = new Connection("https://api.devnet.solana.com", "confirmed");
    const walletKeypair = loadWalletKey(keypairPath);
    const walletPublicKey = walletKeypair.publicKey;

    // Get initial SOL balance
    const initialSOL = await getSOLBalance(connection, walletPublicKey);
    console.log("=== Initial Balances ===");
    console.log(`SOL: ${initialSOL}`);
    console.log("========================");

    try {
        // Step 1: Create a new token
        console.log("\n>>> STEP 1: CREATE TOKEN");
        const tokenResult = await createToken(keypairPath);
        console.log("Token creation successful!");
        console.log(JSON.stringify(tokenResult, null, 2));

        // Store mint and token data addresses for the next steps
        const mintAddress = tokenResult.mint;
        const tokenDataAddress = tokenResult.tokenData;
        const mintPubkey = new PublicKey(mintAddress);

        // Check balance after creation
        const afterCreateSOL = await getSOLBalance(connection, walletPublicKey);
        const afterCreateTokens = await getTokenBalance(connection, walletPublicKey, mintPubkey);

        console.log("\n=== Balances After Creation ===");
        console.log(`SOL: ${afterCreateSOL} (change: ${(afterCreateSOL - initialSOL).toFixed(6)})`);
        console.log(`Tokens: ${afterCreateTokens}`);
        console.log("==============================");

        // Wait a bit for the blockchain to settle
        console.log("Waiting for 2 seconds...");
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Step 2: Buy more tokens
        console.log("\n>>> STEP 2: BUY MORE TOKENS");
        const BUY_AMOUNT_SOL = getRandomBetweenBuy(); // 0.01 SOL
        console.log(`Buying with ${BUY_AMOUNT_SOL} SOL...`);

        const buyResult = await buyToken(
            mintAddress,
            tokenDataAddress,
            BUY_AMOUNT_SOL,
            keypairPath
        );

        console.log("Buy transaction successful!");
        console.log(`Transaction: ${buyResult.signature}`);

        // Check balances after buying
        const afterBuySOL = await getSOLBalance(connection, walletPublicKey);
        const afterBuyTokens = await getTokenBalance(connection, walletPublicKey, mintPubkey);

        console.log("\n=== Balances After Buying ===");
        console.log(`SOL: ${afterBuySOL} (change: ${(afterBuySOL - afterCreateSOL).toFixed(6)})`);
        console.log(`Tokens: ${afterBuyTokens} (change: ${afterBuyTokens && afterCreateTokens ?
            (afterBuyTokens - afterCreateTokens).toFixed(6) : 'unknown'})`);
        console.log("==============================");

        // Wait a bit for the blockchain to settle
        console.log("Waiting for 2 seconds...");
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Step 3: Sell some tokens
        console.log("\n>>> STEP 3: SELL TOKENS");
        const SELL_AMOUNT_TOKENS = getRandomBetweenSell(); // 0.005 tokens with 6 decimals

        if (afterBuyTokens && afterBuyTokens * 1000000 >= SELL_AMOUNT_TOKENS) {
            console.log(`Selling ${SELL_AMOUNT_TOKENS / 1000000} tokens...`);

            const sellResult = await sellToken(
                mintAddress,
                tokenDataAddress,
                SELL_AMOUNT_TOKENS,
                keypairPath
            );

            console.log("Sell transaction successful!");
            console.log(`Transaction: ${sellResult.signature}`);

            // Check final balances
            const finalSOL = await getSOLBalance(connection, walletPublicKey);
            const finalTokens = await getTokenBalance(connection, walletPublicKey, mintPubkey);

            console.log("\n=== Final Balances ===");
            console.log(`SOL: ${finalSOL} (change from start: ${(finalSOL - initialSOL).toFixed(6)})`);
            console.log(`Tokens: ${finalTokens} (change from previous: ${finalTokens && afterBuyTokens ?
                (finalTokens - afterBuyTokens).toFixed(6) : 'unknown'})`);
            console.log("=======================");
        } else {
            console.log(`\nSkipping sell step: Not enough tokens available.`);
            console.log(`Need at least ${SELL_AMOUNT_TOKENS / 1000000} tokens to sell.`);
            console.log(`Current balance: ${afterBuyTokens}`);
        }

        console.log("\n=== COMPLETE TOKEN WORKFLOW FINISHED SUCCESSFULLY ===");

        return {
            token: {
                name: tokenResult.tokenName,
                symbol: tokenResult.tokenSymbol,
                mint: mintAddress,
                tokenData: tokenDataAddress
            },
            balances: {
                initial: initialSOL,
                final: await getSOLBalance(connection, walletPublicKey),
                tokensFinal: await getTokenBalance(connection, walletPublicKey, mintPubkey)
            }
        };
    } catch (error: any) {
        console.error("Error during token workflow:", error);
        if (error.logs) {
            console.error("Transaction logs:");
            error.logs.forEach((log: string, i: number) => {
                console.error(`${i}: ${log}`);
            });
        }
        throw error;
    }
}

// If this script is run directly, execute the workflow
if (require.main === module) {
    // Get keypair path from command line argument if provided
    const keypairPath = process.argv[2] || "~/.config/solana/id.json";

    completeTokenWorkflow(keypairPath)
        .then(result => {
            console.log("Complete token workflow successful:");
            console.log(JSON.stringify(result, null, 2));
        })
        .catch(err => {
            console.error("Token workflow failed:", err);
            process.exit(1);
        });
}

// Export functions for use in other scripts
export {
    completeTokenWorkflow,
    createToken,
    getTokenBalance,
    getSOLBalance,
    TokenCreationResult
};