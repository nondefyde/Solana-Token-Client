// sell-token-client.ts
import {Connection, PublicKey, SystemProgram, Transaction} from '@solana/web3.js';
import {AnchorProvider, BN, Program, Wallet} from '@coral-xyz/anchor';
import {ASSOCIATED_TOKEN_PROGRAM_ID, getAssociatedTokenAddress, TOKEN_2022_PROGRAM_ID} from '@solana/spl-token';
import * as fs from 'fs';
import * as path from 'path';
import {loadWalletKey, setupComputeBudget} from './buy-token-client';

// Interface for token sale result
interface TokenSaleResult {
    sellerAddress: string;
    mintAddress: string;
    tokenDataAddress: string;
    tokenAmount: number;
    signature: string;
}

// Environment variables (set these or pass as parameters)
const TOKEN_MINT_ADDRESS = process.env.TOKEN_MINT_ADDRESS;
const TOKEN_DATA_ADDRESS = process.env.TOKEN_DATA_ADDRESS;
const DEFAULT_TOKEN_AMOUNT = 1000000; // 1 token with 6 decimals

async function sellToken(
    mintAddress: string = TOKEN_MINT_ADDRESS || '',
    tokenDataAddress: string = TOKEN_DATA_ADDRESS || '',
    tokenAmount: number = DEFAULT_TOKEN_AMOUNT,
    keypairPath: string = "~/.config/solana/id.json"
): Promise<TokenSaleResult> {
    // Validate inputs
    if (!mintAddress) {
        throw new Error("Missing mint address. Set TOKEN_MINT_ADDRESS env variable or pass as parameter.");
    }
    if (!tokenDataAddress) {
        throw new Error("Missing token data address. Set TOKEN_DATA_ADDRESS env variable or pass as parameter.");
    }

    console.log(`Preparing to sell ${tokenAmount} tokens from mint: ${mintAddress}`);
    console.log(`Token data address: ${tokenDataAddress}`);

    // Configure connection to blockchain
    const connection = new Connection("https://api.devnet.solana.com", "confirmed");

    // Load wallet keypair
    const walletKeypair = loadWalletKey(keypairPath);
    console.log(`Using wallet address: ${walletKeypair.publicKey.toString()}`);

    // Configure anchor provider
    const wallet = new Wallet(walletKeypair);
    const provider = new AnchorProvider(connection, wallet, {commitment: "confirmed"});

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

    // Initialize program
    const program: any = new Program(idl, provider);

    // Convert string addresses to PublicKeys
    const mintPubkey = new PublicKey(mintAddress);
    const tokenDataPubkey = new PublicKey(tokenDataAddress);

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

        // Get token accounts for seller and pool
        const sellerTokenAccount = await getAssociatedTokenAddress(
            mintPubkey,
            wallet.publicKey,
            false,
            TOKEN_2022_PROGRAM_ID
        );
        console.log(`Seller Token Account: ${sellerTokenAccount.toString()}`);

        const poolTokenAccount = await getAssociatedTokenAddress(
            mintPubkey,
            poolPDA,
            true,
            TOKEN_2022_PROGRAM_ID
        );
        console.log(`Pool Token Account: ${poolTokenAccount.toString()}`);

        // Get token balance to confirm we have enough tokens to sell
        const tokenBalance = await connection.getTokenAccountBalance(sellerTokenAccount);
        console.log(`Current token balance: ${tokenBalance.value.uiAmount}`);

        if (tokenBalance.value.uiAmount === null || tokenBalance.value.uiAmount < tokenAmount / 1000000) {
            throw new Error(`Insufficient token balance. Have: ${tokenBalance.value.uiAmount}, Need: ${tokenAmount / 1000000}`);
        }

        // Get admin settings to find fee and lottery accounts
        console.log("Fetching admin settings...");
        const adminSettings = await program.account.adminSettings.fetch(adminSettingsPDA);
        const feeAccount = adminSettings.platformAccounts.feeAccount;
        const lotteryAccount = adminSettings.platformAccounts.lotteryAccount;

        console.log(`Using fee account: ${feeAccount.toString()}`);
        console.log(`Using lottery account: ${lotteryAccount.toString()}`);

        // Set up compute budget for the transaction
        const {modifyComputeUnits, setComputeUnitPrice} = setupComputeBudget();

        // Prepare the sell instruction
        console.log("Creating sell instruction...");
        const sellIx = await program.methods
            .sell(new BN(tokenAmount))
            .accounts({
                seller: wallet.publicKey,
                token: tokenDataPubkey,
                config: configPDA,
                admin: adminSettingsPDA,
                adminProgram: ADMIN_PROGRAM_ID,
                mint: mintPubkey,
                pool: poolPDA,
                treasury: treasuryPDA,
                poolTokenAccount: poolTokenAccount,
                sellerTokenAccount: sellerTokenAccount,
                feeAccount: feeAccount,
                lotteryAccount: lotteryAccount,
                extraAccountMetaList: extraAccountMetaListPDA,
                hookProgram: HOOK_PROGRAM_ID,
                tokenProgram: TOKEN_2022_PROGRAM_ID,
                associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
                systemProgram: SystemProgram.programId,
            })
            .instruction();

        // Create and sign transaction
        const tx = new Transaction()
            .add(modifyComputeUnits)
            .add(setComputeUnitPrice)
            .add(sellIx);

        console.log("Sending transaction...");
        const signature = await provider.sendAndConfirm(tx);
        console.log("Transaction successful!");
        console.log(`Signature: ${signature}`);
        console.log(`Sold ${tokenAmount} tokens from mint: ${mintPubkey.toString()}`);

        return {
            sellerAddress: wallet.publicKey.toString(),
            mintAddress: mintPubkey.toString(),
            tokenDataAddress: tokenDataPubkey.toString(),
            tokenAmount: tokenAmount,
            signature: signature
        };

    } catch (error: any) {
        console.error("Error selling tokens:", error);
        if (error.logs) {
            console.error("Transaction logs:");
            error.logs.forEach((log: string, i: number) => {
                console.error(`${i}: ${log}`);
            });
        }
        throw error;
    }
}

// If this script is run directly, execute the sell function
if (require.main === module) {
    // Get command line arguments
    const args = process.argv.slice(2);
    const mintAddress = args[0] || TOKEN_MINT_ADDRESS;
    const tokenDataAddress = args[1] || TOKEN_DATA_ADDRESS;
    const tokenAmount = args[2] ? parseInt(args[2]) : DEFAULT_TOKEN_AMOUNT;
    const keypairPath = args[3] || "~/.config/solana/id.json";

    sellToken(mintAddress, tokenDataAddress, tokenAmount, keypairPath)
        .then(result => {
            console.log("Token sale successful:");
            console.log(JSON.stringify(result, null, 2));
        })
        .catch(err => {
            console.error("Token sale failed:", err);
            process.exit(1);
        });
}

// Export for use in other scripts
export {sellToken, TokenSaleResult};