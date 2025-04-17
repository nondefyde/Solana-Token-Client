// token-simulation.ts
import {Connection, LAMPORTS_PER_SOL, PublicKey} from '@solana/web3.js';
import {Wallet} from '@coral-xyz/anchor';
import {getAssociatedTokenAddress, TOKEN_2022_PROGRAM_ID} from '@solana/spl-token';
import * as fs from 'fs';
import {buyToken, loadWalletKey} from './buy-token-client';
import {sellToken} from './sell-token-client';
import {createToken} from './integrated-token-flow';

// Configuration
const NUM_TRANSACTIONS = 5;  // Total number of transactions to simulate
const BUY_RATIO = 0.9;        // 70% buys, 30% sells
const MIN_BUY_SOL = 1;     // Minimum SOL for buy
const MAX_BUY_SOL = 2;      // Maximum SOL for buy
const SELL_PERCENTAGE = 0.3;  // Sell 10% of holdings in each sell transaction
const DELAY_BETWEEN_TXS = 2000; // 2 seconds between transactions
const LOG_FILE = "token_simulation_log.json"; // Log file to save results

// Utility function to generate a random buy amount
function getRandomBuyAmount(): number {
    const amount = MIN_BUY_SOL + Math.random() * (MAX_BUY_SOL - MIN_BUY_SOL);
    return parseFloat(amount.toFixed(3)); // Round to 3 decimal places
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

// Function to log transaction data to a file
function logTransaction(logData: any) {
    let existingData = [];

    // Try to read existing log file
    try {
        if (fs.existsSync(LOG_FILE)) {
            const fileContent = fs.readFileSync(LOG_FILE, 'utf8');
            existingData = JSON.parse(fileContent);
        }
    } catch (error) {
        console.error("Error reading log file:", error);
    }

    // Add new data
    existingData.push(logData);

    // Write back to file
    fs.writeFileSync(LOG_FILE, JSON.stringify(existingData, null, 2));
    console.log("Transaction logged to file");
}

// Sleep function
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Main simulation function
async function simulateTokenActivity(keypairPath: string = "~/.config/solana/id.json") {
    console.log("===== STARTING TOKEN ACTIVITY SIMULATION =====");

    // Configure connection to blockchain
    const connection = new Connection("https://api.devnet.solana.com", "confirmed");
    const walletKeypair = loadWalletKey(keypairPath);
    const wallet = new Wallet(walletKeypair);

    // Initial SOL balance check
    const initialSOL = await getSOLBalance(connection, wallet.publicKey);
    console.log(`Initial SOL balance: ${initialSOL} SOL`);

    if (initialSOL < 2) {
        console.error("Not enough SOL to proceed. Need at least 2 SOL for simulation.");
        return;
    }

    // Step 1: Create a new token
    console.log("\n===== CREATING NEW TOKEN =====");
    let tokenResult;

    try {
        tokenResult = await createToken(keypairPath);
        console.log("Token created successfully:");
        console.log(`- Name: ${tokenResult.tokenName}`);
        console.log(`- Symbol: ${tokenResult.tokenSymbol}`);
        console.log(`- Mint address: ${tokenResult.mint}`);
        console.log(`- Token data address: ${tokenResult.tokenData}`);

        // Log the token creation
        logTransaction({
            type: "CREATE",
            timestamp: new Date().toISOString(),
            token: {
                name: tokenResult.tokenName,
                symbol: tokenResult.tokenSymbol,
                mint: tokenResult.mint,
                tokenData: tokenResult.tokenData
            },
            transaction: tokenResult.signature
        });
    } catch (error) {
        console.error("Failed to create token:", error);
        return;
    }

    // Wait for blockchain to settle
    console.log("Waiting for blockchain to settle...");
    await sleep(DELAY_BETWEEN_TXS);

    // Get the mint and token data addresses for transactions
    const mintAddress = tokenResult.mint;
    const tokenDataAddress = tokenResult.tokenData;
    const mintPubkey = new PublicKey(mintAddress);

    // Transaction simulation loop
    console.log(`\n===== SIMULATING ${NUM_TRANSACTIONS} TRANSACTIONS =====`);
    console.log(`Buy ratio: ${BUY_RATIO * 100}% buys, ${(1 - BUY_RATIO) * 100}% sells`);

    let successfulBuys = 0;
    let successfulSells = 0;

    for (let i = 0; i < NUM_TRANSACTIONS; i++) {
        // Get current token balance
        const currentTokenBalance = await getTokenBalance(connection, wallet.publicKey, mintPubkey);
        const currentSOL = await getSOLBalance(connection, wallet.publicKey);

        console.log(`\n--- Transaction ${i + 1}/${NUM_TRANSACTIONS} ---`);
        console.log(`Current balances: ${currentSOL.toFixed(4)} SOL, ${currentTokenBalance?.toFixed(6) || 0} tokens`);

        // Calculate the expected number of buys so far
        const expectedBuys = Math.ceil(BUY_RATIO * (i + 1));
        const actualBuys = successfulBuys;

        // Decide whether to buy or sell
        let shouldBuy;

        // Force a buy if we're behind on the expected buy ratio
        if (actualBuys < expectedBuys) {
            shouldBuy = true;
        }
        // Force a sell if we have tokens and haven't done many sells relative to our progress
        else if (currentTokenBalance && currentTokenBalance > 0 &&
            successfulSells < (i + 1) * (1 - BUY_RATIO) * 0.8) {
            shouldBuy = false;
        }
        // Otherwise use random choice with the configured ratio
        else {
            shouldBuy = Math.random() < BUY_RATIO;
        }

        // Can only sell if we have tokens
        if (!shouldBuy && (!currentTokenBalance || currentTokenBalance <= 0)) {
            console.log("Wanted to sell but no tokens available. Doing buy instead.");
            shouldBuy = true;
        }

        try {
            if (shouldBuy) {
                // Buy transaction
                const buyAmount = getRandomBuyAmount();

                // Make sure we have enough SOL
                if (currentSOL < buyAmount + 0.01) {  // Add 0.01 for fees
                    console.log(`Not enough SOL for buy (${currentSOL} < ${buyAmount + 0.01}). Skipping.`);
                    continue;
                }

                console.log(`Buying with ${buyAmount} SOL...`);

                const buyResult = await buyToken(
                    mintAddress,
                    tokenDataAddress,
                    buyAmount,
                    keypairPath
                );

                successfulBuys++;

                console.log(`Buy successful! Transaction: ${buyResult.signature}`);

                // Log the buy transaction
                logTransaction({
                    type: "BUY",
                    timestamp: new Date().toISOString(),
                    token: {
                        mint: mintAddress,
                        tokenData: tokenDataAddress
                    },
                    amount: buyAmount,
                    transaction: buyResult.signature
                });
            } else {
                // Sell transaction - calculate token amount to sell (as a percentage of holdings)
                const tokenAmountToSell = Math.floor((currentTokenBalance ?? 0.01) * SELL_PERCENTAGE * 1000000);

                if (tokenAmountToSell < 1000) {
                    console.log("Token amount too small to sell. Doing buy instead.");

                    // Buy instead
                    const buyAmount = getRandomBuyAmount();
                    console.log(`Buying with ${buyAmount} SOL...`);

                    const buyResult = await buyToken(
                        mintAddress,
                        tokenDataAddress,
                        buyAmount,
                        keypairPath
                    );

                    successfulBuys++;

                    console.log(`Buy successful! Transaction: ${buyResult.signature}`);

                    // Log the buy transaction
                    logTransaction({
                        type: "BUY",
                        timestamp: new Date().toISOString(),
                        token: {
                            mint: mintAddress,
                            tokenData: tokenDataAddress
                        },
                        amount: buyAmount,
                        transaction: buyResult.signature
                    });
                } else {
                    console.log(`Selling ${tokenAmountToSell / 1000000} tokens (${SELL_PERCENTAGE * 100}% of holdings)...`);

                    const sellResult = await sellToken(
                        mintAddress,
                        tokenDataAddress,
                        tokenAmountToSell,
                        keypairPath
                    );

                    successfulSells++;

                    console.log(`Sell successful! Transaction: ${sellResult.signature}`);

                    // Log the sell transaction
                    logTransaction({
                        type: "SELL",
                        timestamp: new Date().toISOString(),
                        token: {
                            mint: mintAddress,
                            tokenData: tokenDataAddress
                        },
                        amount: tokenAmountToSell / 1000000,
                        transaction: sellResult.signature
                    });
                }
            }
        } catch (error) {
            console.error(`Transaction ${i + 1} failed:`, error);
            console.log("Continuing with next transaction...");
        }

        // Wait between transactions
        if (i < NUM_TRANSACTIONS - 1) {
            console.log(`Waiting ${DELAY_BETWEEN_TXS / 1000} seconds before next transaction...`);
            await sleep(DELAY_BETWEEN_TXS);
        }
    }

    // Get final balances
    const finalSOL = await getSOLBalance(connection, wallet.publicKey);
    const finalTokenBalance = await getTokenBalance(connection, wallet.publicKey, mintPubkey);

    console.log("\n===== SIMULATION COMPLETE =====");
    console.log(`Started with: ${initialSOL.toFixed(4)} SOL, 0 tokens`);
    console.log(`Ended with: ${finalSOL.toFixed(4)} SOL, ${finalTokenBalance?.toFixed(6) || 0} tokens`);
    console.log(`SOL change: ${(finalSOL - initialSOL).toFixed(4)} SOL`);
    console.log(`Successful transactions: ${successfulBuys} buys, ${successfulSells} sells`);
    console.log(`Transaction log saved to: ${LOG_FILE}`);

    return {
        token: {
            name: tokenResult.tokenName,
            symbol: tokenResult.tokenSymbol,
            mint: mintAddress,
            tokenData: tokenDataAddress
        },
        transactions: {
            total: successfulBuys + successfulSells,
            buys: successfulBuys,
            sells: successfulSells
        },
        balances: {
            initial: {sol: initialSOL, tokens: 0},
            final: {sol: finalSOL, tokens: finalTokenBalance}
        }
    };
}

// If this script is run directly, execute the simulation
if (require.main === module) {
    // Get keypair path from command line argument if provided
    const keypairPath = process.argv[2] || "~/.config/solana/id.json";

    simulateTokenActivity(keypairPath)
        .then(result => {
            console.log("Simulation completed successfully!");
        })
        .catch(err => {
            console.error("Simulation failed:", err);
            process.exit(1);
        });
}

// Export for use in other scripts
export {simulateTokenActivity};