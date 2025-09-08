import {
  Contract as ContractEthers,
  JsonRpcSigner,
  BrowserProvider,
  parseEther,
} from "ethers";
import ContractABI from "./abi/contract.abi.json";
import { showError } from "../utils/toast";

const contractAddress = import.meta.env.CONTRACT_ADDRESS || "";

class Contract {
  contract: ContractEthers | undefined;
  provider: BrowserProvider | undefined;
  signer: JsonRpcSigner | undefined;

  initContract(signer: JsonRpcSigner, provider: BrowserProvider) {
    this.contract = new ContractEthers(contractAddress, ContractABI, signer);
    this.provider = provider;
    this.signer = signer;
  }

  async mintItem() {
    if (this.contract) {
      try {
        const walletAddress = await this.signer?.getAddress();
        const tx = await this.contract.mint(walletAddress, 1, {
          value: parseEther("0.05"), // if mint costs 0.05 ETH
        });
        console.log("Mint transaction:", tx.hash);
        return tx;
      } catch (error) {
        showError(error);
      }
    }
  }

  /**
   * Sets approval for all tokens for an operator
   * @param operator - The address to approve/revoke as an operator
   * @param approved - True to approve, false to revoke approval
   * @returns Transaction hash if successful
   */
  async setApprovalForAll(
    operator: string,
    approved: boolean
  ): Promise<string | undefined> {
    if (!this.contract) {
      showError("Contract not initialized");
      return;
    }

    if (!operator || !operator.match(/^0x[a-fA-F0-9]{40}$/)) {
      showError("Invalid operator address format");
      return;
    }

    try {
      const tx = await this.contract.setApprovalForAll(operator, approved);
      console.log(
        `Setting approval for operator ${operator} to ${approved}. Transaction hash: ${tx.hash}`
      );

      // Wait for transaction confirmation
      const receipt = await tx.wait();
      console.log(
        `Transaction confirmed with ${receipt?.confirmations} confirmations`
      );

      return tx.hash;
    } catch (error) {
      console.error("Error setting approval for all:", error);
      showError(error);
      return;
    }
  }

  /**
   * Checks if an operator is approved for all tokens of an account
   * @param account - The account address
   * @param operator - The operator address to check
   * @returns True if approved, false otherwise
   */
  async isApprovedForAll(
    account: string,
    operator: string
  ): Promise<boolean | undefined> {
    if (!this.contract) {
      showError("Contract not initialized");
      return;
    }

    try {
      const isApproved = await this.contract.isApprovedForAll(
        account,
        operator
      );
      console.log(
        `Operator ${operator} approval status for account ${account}: ${isApproved}`
      );
      return isApproved;
    } catch (error) {
      console.error("Error checking approval status:", error);
      showError(error);
      return;
    }
  }
}

const ContractBase = new Contract();
export default ContractBase;
