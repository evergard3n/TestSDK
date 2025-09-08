import { ethers } from "ethers";

export interface TransferResult {
  success: boolean;
  txHash?: string;
  receipt?: any;
  error?: string;
}

export interface MagicTransferOptions {
  to: string;
  amount: string; // in ETH
  gasLimit?: bigint;
  gasPrice?: bigint;
  memo?: string; // Optional memo (not stored on-chain for basic ETH transfers)
}

export class MagicETHTransfer {
  private signer: ethers.JsonRpcSigner;

  constructor(signer: ethers.JsonRpcSigner) {
    this.signer = signer;
  }

  /**
   * Transfer ETH with magic ✨
   */
  async transfer(options: MagicTransferOptions): Promise<TransferResult> {
    try {
      const { to, amount, gasLimit, gasPrice, memo } = options;

      // Validate address
      if (!ethers.isAddress(to)) {
        return { success: false, error: "Invalid recipient address" };
      }

      // Validate amount
      if (isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
        return { success: false, error: "Invalid amount" };
      }

      console.log("🪄 Initiating magic transfer...");
      if (memo) {
        console.log(`📝 Memo: ${memo}`);
      }

      // Get current network for appropriate gas estimation
      const network = await this.signer.provider.getNetwork();
      console.log(`🌐 Network: ${network.name} (Chain ID: ${network.chainId})`);

      // Prepare transaction
      const tx: any = {
        to,
        value: ethers.parseEther(amount),
      };

      // Add gas parameters if provided
      if (gasLimit) {
        tx.gasLimit = gasLimit;
      } else {
        // Estimate gas
        tx.gasLimit = await this.signer.provider.estimateGas(tx);
      }

      if (gasPrice) {
        tx.gasPrice = gasPrice;
      } else {
        // Get current gas price
        const feeData = await this.signer.provider.getFeeData();
        tx.gasPrice = feeData.gasPrice;
      }

      // Send transaction
      const transaction = await this.signer.sendTransaction(tx);
      console.log(`🚀 Transaction sent: ${transaction.hash}`);

      // Wait for confirmation
      const receipt = await transaction.wait();
      console.log("✅ Transfer confirmed!");

      return {
        success: true,
        txHash: transaction.hash,
        receipt,
      };
    } catch (error: any) {
      console.error("💥 Transfer failed:", error);
      return {
        success: false,
        error: error.message || "Unknown error occurred",
      };
    }
  }

  /**
   * Get current balance
   */
  async getBalance(): Promise<string> {
    const address = await this.signer.getAddress();
    const balance = await this.signer.provider.getBalance(address);
    return ethers.formatEther(balance);
  }

  /**
   * Get transaction history (limited to recent transactions)
   */
  async getRecentTransactions(count: number = 10): Promise<any[]> {
    try {
      const address = await this.signer.getAddress();
      const currentBlock = await this.signer.provider.getBlockNumber();
      const fromBlock = Math.max(0, currentBlock - 1000); // Last 1000 blocks

      // Note: This is a basic implementation
      // For production, you'd want to use a service like Etherscan API
      console.log(
        `📊 Checking blocks ${fromBlock} to ${currentBlock} for ${address}`
      );
      console.log(`Requested ${count} recent transactions`);

      return []; // Placeholder - implement with actual block scanning or API
    } catch (error) {
      console.error("Failed to get transaction history:", error);
      return [];
    }
  }

  /**
   * Batch transfer to multiple addresses
   */
  async batchTransfer(
    transfers: { to: string; amount: string }[]
  ): Promise<TransferResult[]> {
    const results: TransferResult[] = [];

    for (const transfer of transfers) {
      console.log(
        `🔄 Processing transfer ${transfers.indexOf(transfer) + 1}/${
          transfers.length
        }`
      );
      const result = await this.transfer(transfer);
      results.push(result);

      // Add delay between transactions to avoid nonce issues
      if (transfers.indexOf(transfer) < transfers.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }

    return results;
  }

  /**
   * Estimate total cost (amount + gas) for a transfer
   */
  async estimateTotalCost(
    to: string,
    amount: string
  ): Promise<{
    transferAmount: string;
    estimatedGasFee: string;
    totalCost: string;
  }> {
    const gasEstimate = await this.signer.provider.estimateGas({
      to,
      value: ethers.parseEther(amount),
    });

    const gasPrice = await this.signer.provider.getFeeData();
    const gasFee = gasEstimate * (gasPrice.gasPrice || 0n);

    return {
      transferAmount: amount,
      estimatedGasFee: ethers.formatEther(gasFee),
      totalCost: ethers.formatEther(ethers.parseEther(amount) + gasFee),
    };
  }
}

/**
 * Utility function to format ETH amounts nicely
 */
export function formatETH(wei: bigint | string, decimals: number = 4): string {
  const eth = ethers.formatEther(wei);
  return parseFloat(eth).toFixed(decimals);
}

/**
 * Utility function to validate Ethereum address
 */
export function isValidAddress(address: string): boolean {
  return ethers.isAddress(address);
}

/**
 * Utility function to convert various units to Wei
 */
export function parseUnits(
  value: string,
  unit: "ether" | "gwei" | "wei" = "ether"
): bigint {
  return ethers.parseUnits(value, unit);
}
