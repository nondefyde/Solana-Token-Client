// token-test-client.ts
import {Connection, LAMPORTS_PER_SOL, PublicKey} from '@solana/web3.js';
import {Wallet} from '@coral-xyz/anchor';
import {getAssociatedTokenAddress, TOKEN_2022_PROGRAM_ID} from '@solana/spl-token';
import * as fs from 'fs';
import * as path from 'path';
import {buyToken, loadWalletKey} from './buy-token-client';
import {sellToken} from './sell-token-client';

// Check and load environment variables from .env file if it exists
try {
    const envPath = path.resolve('.env');
    if (fs.existsSync(envPath)) {
        console.log(`Loading environment variables from ${envPath}`);
        const envConfig = fs.readFileSync(envPath, 'utf8')
            .split('\n')
            .filter(line => line.trim() && !line.startsWith('#'))
            .reduce((config: Record<string, string>, line) => {
                const [key, value] = line.split('=').map(part => part.trim());
                if (key && value) {
                    config[key] = value.replace(/^['"]|['"]$/g, ''); // Remove quotes if present
                }
                return config;
            }, {});

        Object.assign(process.env, envConfig);
    }
} catch (error) {
    console.warn('Warning: Failed to load .env file', error);
}

// Token addresses - override these with command-line arguments or environment variables
const DEFAULT_MINT_ADDRESS = process.env.TOKEN_MINT_ADDRESS || '';
const DEFAULT_TOKEN_DATA_ADDRESS = process.env.TOKEN_DATA_ADDRESS || '';

// Test parameters
const BUY_AMOUNT_SOL = 0.01; // 0.01 SOL
const SELL_AMOUNT_TOKENS = 5000; // 0.005 tokens with 6 decimals

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

async function getSOLBalance(connection: Connection, address: PublicKey): Promise<number> {
    const balance = await connection.getBalance(address);
    return balance / LAMPORTS_PER_SOL;
}

async function tokenWorkflow(
    mintAddress: string = DEFAULT_MINT_ADDRESS,
    tokenDataAddress: string = DEFAULT_TOKEN_DATA_ADDRESS,
    keypairPath: string = "~/.config/solana/id.json"
) {
    // Validate inputs
    if (!mintAddress || !tokenDataAddress) {
        console.error("Missing required token addresses!");
        console.error("You can set TOKEN_MINT_ADDRESS and TOKEN_DATA_ADDRESS environment variables");
        console.error("Or create a .env file with these values");
        console.error("Or pass them as command-line arguments");
        process.exit(1);
    }

    console.log("Starting token test workflow...");
    console.log(`Using token mint: ${mintAddress}`);
    console.log(`Using token data: ${tokenDataAddress}`);

    // Set up connection and wallet
    const connection = new Connection("https://api.devnet.solana.com", "confirmed");
    const walletKeypair = loadWalletKey(keypairPath);
    const wallet = new Wallet(walletKeypair);
    const publicKey = wallet.publicKey;

    // Get initial balances
    const initialSOL = await getSOLBalance(connection, publicKey);
    const mintPubkey = new PublicKey(mintAddress);
    const initialTokens = await getTokenBalance(connection, publicKey, mintPubkey);

    console.log("=== Initial Balances ===");
    console.log(`SOL: ${initialSOL}`);
    console.log(`Tokens: ${initialTokens}`);
    console.log("========================");

    try {
        // Step 1: Buy tokens
        console.log("\n=== BUYING TOKENS ===");
        console.log(`Buying with ${BUY_AMOUNT_SOL} SOL...`);

        const buyResult = await buyToken(
            mintAddress,
            tokenDataAddress,
            BUY_AMOUNT_SOL,
            keypairPath
        );

        console.log("Buy transaction successful!");
        console.log(`Transaction: ${buyResult.signature}`);

        // Step 2: Check balances after buying
        const afterBuySOL = await getSOLBalance(connection, publicKey);
        const afterBuyTokens = await getTokenBalance(connection, publicKey, mintPubkey);

        console.log("\n=== Balances After Buying ===");
        console.log(`SOL: ${afterBuySOL} (change: ${(afterBuySOL - initialSOL).toFixed(6)})`);
        console.log(`Tokens: ${afterBuyTokens} (change: ${afterBuyTokens && initialTokens ?
            (afterBuyTokens - initialTokens).toFixed(6) : 'unknown'})`);
        console.log("==============================");

        // Step 3: Sell tokens (if we have enough)
        if (afterBuyTokens && afterBuyTokens * 1000000 >= SELL_AMOUNT_TOKENS) {
            console.log("\n=== SELLING TOKENS ===");
            console.log(`Selling ${SELL_AMOUNT_TOKENS / 1000000} tokens...`);

            const sellResult = await sellToken(
                mintAddress,
                tokenDataAddress,
                SELL_AMOUNT_TOKENS,
                keypairPath
            );

            console.log("Sell transaction successful!");
            console.log(`Transaction: ${sellResult.signature}`);

            // Step 4: Check final balances
            const finalSOL = await getSOLBalance(connection, publicKey);
            const finalTokens = await getTokenBalance(connection, publicKey, mintPubkey);

            console.log("\n=== Final Balances ===");
            console.log(`SOL: ${finalSOL} (change from start: ${(finalSOL - initialSOL).toFixed(6)})`);
            console.log(`Tokens: ${finalTokens} (change from start: ${finalTokens && initialTokens ?
                (finalTokens - initialTokens).toFixed(6) : 'unknown'})`);
            console.log("=======================");
        } else {
            console.log("\nSkipping sell step: Not enough tokens available.");
            console.log(`Need at least ${SELL_AMOUNT_TOKENS / 1000000} tokens to sell.`);
        }

        console.log("\n=== TEST WORKFLOW COMPLETE ===");

    } catch (error: any) {
        console.error("Error during token workflow:", error);
        if (error.logs) {
            console.error("Transaction logs:");
            error.logs.forEach((log: string, i: number) => {
                console.error(`${i}: ${log}`);
            });
        }
    }
}

// If this script is run directly, execute the workflow
if (require.main === module) {
    // Get command line arguments
    const args = process.argv.slice(2);
    const mintAddress = args[0] || DEFAULT_MINT_ADDRESS;
    const tokenDataAddress = args[1] || DEFAULT_TOKEN_DATA_ADDRESS;
    const keypairPath = args[2] || "~/.config/solana/id.json";

    tokenWorkflow(mintAddress, tokenDataAddress, keypairPath)
        .then(() => {
            console.log("Token workflow completed successfully");
        })
        .catch(err => {
            console.error("Token workflow failed:", err);
            process.exit(1);
        });
}