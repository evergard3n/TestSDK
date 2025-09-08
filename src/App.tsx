import axios from "axios";
import Cookies from "js-cookie";
import { ethers } from "ethers";
import { useCallback, useEffect, useState } from "react";
import { useWeb3 } from "../dist";
import { accessToken, sessionToken } from "./const";
import { MagicETHTransfer } from "./utils/magicTransfer";
import ContractABI from "./web3/abi/contract.abi.json";

// Contract address - you can move this to an env variable
const contractAddress =
  import.meta.env.VITE_CONTRACT_ADDRESS ||
  "0x0000000000000000000000000000000000000000";

function App() {
  const [email, setEmail] = useState("");
  const [step, setStep] = useState<"email" | "otp">("email");
  const [otp, setOTP] = useState("");
  const [log, setLog] = useState<any>();
  // const [OTPCount, setOTPCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Transfer ETH state
  const [transferTo, setTransferTo] = useState("");
  const [transferAmount, setTransferAmount] = useState("");
  const [currentBalance, setCurrentBalance] = useState<string | null>(null);

  // Approval state
  const [operatorAddress, setOperatorAddress] = useState("");
  const [isApproved, setIsApproved] = useState<boolean>(false);
  const [approvalStatus, setApprovalStatus] = useState<boolean | null>(null);
  const [approvalLoading, setApprovalLoading] = useState(false);

  const {
    loginMagic,
    verifyOTPMagic,
    // setIsSendingOTP,
    isVerifyingOTP,
    checkLoggedInMagic,
    disconnectWallet,
    ethersSigner,
    nftContract,
    magic,
    listNFT,
    history,
  } = useWeb3();

  console.log({ magic });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log("Đang đăng nhập với:", { email });

    await loginMagic?.({
      email: email,
      onSuccess: () => {
        setStep("otp");
      },
      onFail: () => {},
      onOTPSent: () => setStep("otp"),
      onVerifyOTPFail: () => {
        setOTP("");
        setError("Invalid OTP");
      },
      onLocked: () => {
        console.log("Locked");
        setStep("email");
        setOTP("");
        setError("Locked: Too many attempts");
      },
      onExpiredEmailOTP: () => {
        setError("OTP Expired");
      },
      onLoginThrottled: () => {
        setError("Login Throttled");
      },
      onDone: () => {
        setError(null);
        console.log("Đăng nhập thanh cong", step);
      },
      onError: (reason) => {
        setError("Login Failed");
        console.log(">>>>>> reason", reason);
        console.log(">>>>>> reason.code", reason?.code);
        console.log(">>>>>> reason.message", reason?.message);
        {
          /****
          >>>>>> reason r5: Magic RPC Error: [-32602] Invalid params: Please provide a valid email address. Dia chi email khong hop le
          >>>>>> reason r5: Magic RPC Error: [-32603] Internal server error : Loi nay se roi vao cac truong hop: nhap sai otp 3 lan lien tiep, khong co mang khi login
           */
        }
        if (reason?.code === -32603) {
          setStep("email");
        }
      },
    });
  };

  const handleLogout = useCallback(
    async (e: React.FormEvent) => {
      console.log({ disconnectWallet });
      e.preventDefault();
      await disconnectWallet();
    },
    [disconnectWallet]
  );

  async function mintNFT() {
    if (ethersSigner && nftContract) {
      // Gọi hàm mint (chỉ cần address)

      try {
        // const address = await ethersSigner.getAddress();
        const address = "0x0000000000000000000000000000000000000000";
        console.log("get Address:", address);

        // ⚠️ ở đây phải đúng tên function trong ABI, có thể là "mint", "safeMint", "mintTo", v.v.
        const tx = await nftContract.mint(address);
        console.log("Minting... tx hash:", tx.hash);

        const receipt = await tx.wait();
        setLog(receipt);
        console.log("Mint thành công:", receipt);
      } catch (err: any) {
        console.log({ err });
        if (err?.error?.data) {
          const decoded = ethers.AbiCoder.defaultAbiCoder().decode(
            ["string"],
            "0x" + err.error.data.slice(10) // bỏ 4 byte selector đầu
          );
          console.log("Decoded reason:", decoded[0]);
        }
      }
    }
  }

  // Magic function to get current ETH balance
  async function getCurrentBalance() {
    if (!ethersSigner) {
      console.error("No signer available. Please login first.");
      return;
    }

    try {
      const address = await ethersSigner.getAddress();
      const balance = await ethersSigner.provider.getBalance(address);
      const balanceInEth = ethers.formatEther(balance);
      setCurrentBalance(balanceInEth);
      console.log(`Current balance: ${balanceInEth} ETH`);
      return balanceInEth;
    } catch (error) {
      console.error("Failed to get balance:", error);
      setError("Failed to get balance");
    }
  }

  // Magic function to transfer ETH
  async function transferETH(toAddress: string, amount: string) {
    if (!ethersSigner) {
      console.error("No signer available. Please login first.");
      setError("Please login first to transfer ETH");
      return;
    }

    try {
      // Validate inputs
      if (!ethers.isAddress(toAddress)) {
        setError("Invalid recipient address");
        return;
      }

      if (isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
        setError("Invalid amount");
        return;
      }

      // Get sender address and current balance
      const fromAddress = await ethersSigner.getAddress();
      const currentBalance = await ethersSigner.provider.getBalance(
        fromAddress
      );
      const currentBalanceInEth = ethers.formatEther(currentBalance);

      console.log(`✨ Magic Transfer initiated!`);
      console.log(`From: ${fromAddress}`);
      console.log(`To: ${toAddress}`);
      console.log(`Amount: ${amount} ETH`);
      console.log(`Current Balance: ${currentBalanceInEth} ETH`);

      // Check if sufficient balance
      if (parseFloat(currentBalanceInEth) < parseFloat(amount)) {
        setError(`Insufficient balance. Current: ${currentBalanceInEth} ETH`);
        return;
      }

      // Estimate gas
      const gasEstimate = await ethersSigner.provider.estimateGas({
        to: toAddress,
        value: ethers.parseEther(amount),
      });

      // Get current gas price
      const gasPrice = await ethersSigner.provider.getFeeData();

      // Prepare transaction with dynamic gas
      const tx = {
        to: toAddress,
        value: ethers.parseEther(amount),
        gasLimit: gasEstimate,
        gasPrice: gasPrice.gasPrice,
      };

      console.log(`Estimated gas: ${gasEstimate.toString()}`);
      console.log(`Gas price: ${gasPrice.gasPrice?.toString()} wei`);

      // Send transaction
      const transaction = await ethersSigner.sendTransaction(tx);
      console.log("🚀 Transaction sent! Hash:", transaction.hash);
      console.log("⏳ Waiting for confirmation...");

      // Wait for confirmation
      const receipt = await transaction.wait();
      console.log("✅ Transfer successful! Receipt:", receipt);

      // Calculate actual fee paid
      const actualFee =
        receipt?.gasUsed && receipt?.gasPrice
          ? ethers.formatEther(receipt.gasUsed * receipt.gasPrice)
          : "Unknown";

      // Update log for UI feedback
      setLog({
        ...receipt,
        type: "eth_transfer",
        from: fromAddress,
        to: toAddress,
        amount: amount,
        actualFee: actualFee,
        timestamp: new Date().toISOString(),
      });

      // Update balance after transfer
      await getCurrentBalance();

      // Clear form
      setTransferTo("");
      setTransferAmount("");
      setError(null);

      return receipt;
    } catch (error: any) {
      console.error("💥 Transfer failed:", error);

      // Handle specific error types
      if (error.code === "INSUFFICIENT_FUNDS") {
        setError("Insufficient funds for this transfer (including gas fees)");
      } else if (error.code === "INVALID_ARGUMENT") {
        setError("Invalid address or amount");
      } else if (error.code === "REPLACEMENT_UNDERPRICED") {
        setError("Transaction underpriced. Try increasing gas price.");
      } else if (error.code === "NONCE_EXPIRED") {
        setError("Transaction nonce expired. Please try again.");
      } else {
        setError(`Transfer failed: ${error.message || "Unknown error"}`);
      }

      throw error;
    }
  }

  // Function to create contract instance
  function createContract() {
    if (!ethersSigner) {
      throw new Error("Signer not available");
    }
    return new ethers.Contract(contractAddress, ContractABI, ethersSigner);
  }

  // Function to handle setApprovalForAll
  async function handleSetApprovalForAll() {
    if (!ethersSigner) {
      setError("Please login first to set approval");
      return;
    }

    if (!operatorAddress) {
      setError("Please enter an operator address");
      return;
    }
    if (!nftContract) {
      setError("NFT Contract not initialized");
      return;
    }

    setApprovalLoading(true);
    setError(null);

    try {
      const tx = await nftContract.setApprovalForAll(
        "0x1F07562a655b2be702f5480E9B8950BfC209253",
        true
      );

      console.log(
        `Setting approval for operator ${operatorAddress} to ${isApproved}. Transaction hash: ${tx.hash}`
      );

      // Wait for transaction confirmation
      const receipt = await tx.wait();
      console.log(`Transaction confirmed with ${receipt} confirmations`);

      if (tx.hash) {
        console.log(
          `✅ Approval ${
            isApproved ? "granted" : "revoked"
          } for operator: ${operatorAddress}`
        );
        setLog({
          type: "set_approval_for_all",
          operator: operatorAddress,
          approved: isApproved,
          txHash: tx.hash,
          timestamp: new Date().toISOString(),
        });

        // Check the approval status after setting
        await checkApprovalStatus();
      }
    } catch (error: any) {
      console.log("Failed to set approval:", error);
      setError(`Failed to set approval: ${error.message || "Unknown error"}`);
    } finally {
      setApprovalLoading(false);
    }
  }

  // Function to check approval status
  async function checkApprovalStatus() {
    if (!ethersSigner || !operatorAddress) {
      return;
    }

    if (!ethers.isAddress(operatorAddress)) {
      setError("Invalid operator address format");
      return;
    }

    if (!nftContract) {
      setError("NFT Contract not initialized");
      return;
    }

    try {
      const userAddress = await ethersSigner.getAddress();
      const status = await nftContract.isApprovedForAll(
        userAddress,
        operatorAddress
      );

      setApprovalStatus(status || false);
      console.log(`Approval status for ${operatorAddress}: ${status}`);
    } catch (error: any) {
      console.error("Failed to check approval status:", error);
      setError(`Failed to check approval: ${error.message || "Unknown error"}`);
    }
  }

  console.log({ log });
  const onList = useCallback(async () => {
    console.log({ log });
    // const data =
    if (log) {
      const data = await listNFT({
        price: "0.1",
        amount: 1,
        tokenId: log.logs[0].topics[3],
      });
      console.log({ data });
    }
  }, [listNFT, log]);

  useEffect(() => {
    if (step !== "otp") return;

    if (otp.length === 6) {
      verifyOTPMagic?.(otp, () => {});
    }
  }, [otp, step]);

  // Auto-refresh balance when signer becomes available
  useEffect(() => {
    if (ethersSigner) {
      getCurrentBalance();
    }
  }, [ethersSigner]);

  const setCookie = () => {
    Cookies.set("access_token", accessToken);
    Cookies.set("session", sessionToken);
  };

  const onCheckAuthorize = async () => {
    try {
      const res = await axios.put(
        "/api/authorize",
        {},
        { withCredentials: true }
      );
      console.log(res.data);
    } catch (e) {
      console.log(e);
    }
  };

  return (
    <>
      <div>
        <form onSubmit={handleLogout}>
          <button
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-700 text-white p-2 rounded-lg transition"
          >
            Logout
          </button>
        </form>
        <button
          onClick={async () => {
            const rs = await checkLoggedInMagic();
            console.log({ rs });
          }}
        >
          Check
        </button>

        <button
          onClick={() => {
            setStep("otp");
          }}
        >
          next step
        </button>

        <button onClick={mintNFT}>Mint</button>
        <button onClick={() => console.log(magic?.wallet?.showAddress())}>
          Address
        </button>
        <button onClick={() => console.log(magic?.user?.getIdToken())}>
          xx
        </button>
        <button onClick={() => console.log(magic?.wallet?.showBalances())}>
          pp
        </button>
        <button onClick={onList}>List</button>
        <button
          onClick={async () => {
            const xxx = await history();
            console.log({ xxx });
          }}
        >
          history
        </button>
        <button onClick={setCookie}>set Cookie</button>

        <button onClick={onCheckAuthorize}>call api author</button>

        {/* ETH Transfer Section */}
        <div className="mt-4 p-4 border border-gray-300 rounded-lg">
          <h3 className="text-lg font-semibold mb-2">✨ Magic ETH Transfer</h3>

          {/* Balance Display */}
          <div className="mb-3 p-2 bg-gray-100 rounded">
            <div className="flex justify-between items-center">
              <span className="text-sm">Current Balance:</span>
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold">
                  {currentBalance ? `${currentBalance} ETH` : "Loading..."}
                </span>
                <button
                  onClick={getCurrentBalance}
                  className="text-xs bg-blue-500 hover:bg-blue-600 text-white px-2 py-1 rounded"
                >
                  Refresh
                </button>
              </div>
            </div>
          </div>

          <div className="mb-2">
            <label className="block text-sm font-medium mb-1">To Address</label>
            <input
              type="text"
              value={transferTo}
              onChange={(e) => setTransferTo(e.target.value)}
              placeholder="0x..."
              className="w-full border border-gray-300 p-2 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
          <div className="mb-2">
            <label className="block text-sm font-medium mb-1">
              Amount (ETH)
            </label>
            <input
              type="text"
              value={transferAmount}
              onChange={(e) => setTransferAmount(e.target.value)}
              placeholder="0.01"
              className="w-full border border-gray-300 p-2 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            />
            <div className="flex gap-1 mt-1">
              <button
                onClick={() => setTransferAmount("0.001")}
                className="text-xs bg-gray-200 hover:bg-gray-300 px-2 py-1 rounded"
              >
                0.001
              </button>
              <button
                onClick={() => setTransferAmount("0.01")}
                className="text-xs bg-gray-200 hover:bg-gray-300 px-2 py-1 rounded"
              >
                0.01
              </button>
              <button
                onClick={() => setTransferAmount("0.1")}
                className="text-xs bg-gray-200 hover:bg-gray-300 px-2 py-1 rounded"
              >
                0.1
              </button>
            </div>
          </div>
          <button
            onClick={async () => {
              if (transferTo && transferAmount) {
                await transferETH(transferTo, transferAmount);
              } else {
                setError("Please enter both address and amount");
              }
            }}
            className="w-full bg-green-600 hover:bg-green-700 text-white p-2 rounded-lg transition font-semibold mb-2"
            disabled={!transferTo || !transferAmount}
          >
            🪄 Transfer ETH Magically
          </button>

          {/* Alternative transfer using utility class */}
          <button
            onClick={async () => {
              if (transferTo && transferAmount && ethersSigner) {
                try {
                  const magicTransfer = new MagicETHTransfer(ethersSigner);
                  const result = await magicTransfer.transfer({
                    to: transferTo,
                    amount: transferAmount,
                    memo: "Transfer via Magic SDK utility",
                  });

                  if (result.success) {
                    console.log(
                      "✨ Utility class transfer successful!",
                      result
                    );
                    setLog({
                      hash: result.txHash,
                      type: "eth_transfer_utility",
                      to: transferTo,
                      amount: transferAmount,
                      timestamp: new Date().toISOString(),
                    });
                    setTransferTo("");
                    setTransferAmount("");
                    setError(null);
                    await getCurrentBalance();
                  } else {
                    setError(result.error || "Transfer failed");
                  }
                } catch (e) {
                  console.error("Utility transfer error:", e);
                }
              }
            }}
            className="w-full bg-purple-600 hover:bg-purple-700 text-white p-2 rounded-lg transition font-semibold text-sm"
            disabled={!transferTo || !transferAmount || !ethersSigner}
          >
            ✨ Transfer with Utility Class
          </button>

          {/* Transaction Result Display */}
          {log && log.type === "eth_transfer" && (
            <div className="mt-3 p-2 bg-green-100 border border-green-300 rounded">
              <h4 className="font-semibold text-green-800">
                ✅ Transfer Successful!
              </h4>
              <div className="text-xs text-green-700 mt-1">
                <p>Amount: {log.amount} ETH</p>
                <p>To: {log.to}</p>
                <p>Gas Fee: {log.actualFee} ETH</p>
                <p>Hash: {log.hash}</p>
              </div>
            </div>
          )}
        </div>

        {/* Approval for All Section */}
        <div className="mt-4 p-4 border border-gray-300 rounded-lg">
          <h3 className="text-lg font-semibold mb-2">
            🔐 Set Approval for All
          </h3>
          <p className="text-sm text-gray-600 mb-3">
            Grant or revoke permission for an operator to manage all your tokens
          </p>

          <div className="mb-3">
            <label className="block text-sm font-medium mb-1">
              Operator Address
            </label>
            <input
              type="text"
              value={operatorAddress}
              onChange={(e) => setOperatorAddress(e.target.value)}
              placeholder="0x..."
              className="w-full border border-gray-300 p-2 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>

          <div className="mb-3">
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={isApproved}
                onChange={(e) => setIsApproved(e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
              />
              <span className="text-sm font-medium">
                {isApproved ? "✅ Grant Approval" : "❌ Revoke Approval"}
              </span>
            </label>
          </div>

          <div className="flex gap-2 mb-3">
            <button
              onClick={handleSetApprovalForAll}
              className={`flex-1 text-white p-2 rounded-lg transition font-semibold ${
                isApproved
                  ? "bg-green-600 hover:bg-green-700"
                  : "bg-red-600 hover:bg-red-700"
              }`}
              disabled={!operatorAddress || approvalLoading || !ethersSigner}
            >
              {approvalLoading
                ? "⏳ Processing..."
                : `${isApproved ? "🔓 Grant" : "🔒 Revoke"} Approval`}
            </button>

            <button
              onClick={checkApprovalStatus}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition text-sm"
              disabled={!operatorAddress || !ethersSigner}
            >
              🔍 Check Status
            </button>
          </div>

          {/* Approval Status Display */}
          {approvalStatus !== null && (
            <div
              className={`p-2 rounded ${
                approvalStatus
                  ? "bg-green-100 border border-green-300"
                  : "bg-orange-100 border border-orange-300"
              }`}
            >
              <p
                className={`text-sm font-medium ${
                  approvalStatus ? "text-green-800" : "text-orange-800"
                }`}
              >
                {approvalStatus
                  ? `✅ Operator ${operatorAddress} is APPROVED for all tokens`
                  : `❌ Operator ${operatorAddress} is NOT APPROVED for all tokens`}
              </p>
            </div>
          )}

          {/* Transaction Result Display */}
          {log && log.type === "set_approval_for_all" && (
            <div className="mt-3 p-2 bg-blue-100 border border-blue-300 rounded">
              <h4 className="font-semibold text-blue-800">
                🔐 Approval Transaction Complete!
              </h4>
              <div className="text-xs text-blue-700 mt-1">
                <p>Operator: {log.operator}</p>
                <p>Approved: {log.approved ? "Yes" : "No"}</p>
                <p>Transaction Hash: {log.txHash}</p>
                <p>Time: {new Date(log.timestamp).toLocaleString()}</p>
              </div>
            </div>
          )}

          {/* Quick Test Addresses */}
          <div className="mt-3 pt-3 border-t border-gray-200">
            <p className="text-xs text-gray-500 mb-2">Quick test addresses:</p>
            <div className="flex gap-1 flex-wrap">
              <button
                onClick={() =>
                  setOperatorAddress(
                    "0x0000000000000000000000000000000000000001"
                  )
                }
                className="text-xs bg-gray-200 hover:bg-gray-300 px-2 py-1 rounded"
              >
                Test Address 1
              </button>
              <button
                onClick={() =>
                  setOperatorAddress(
                    "0x0000000000000000000000000000000000000002"
                  )
                }
                className="text-xs bg-gray-200 hover:bg-gray-300 px-2 py-1 rounded"
              >
                Test Address 2
              </button>
            </div>
          </div>
        </div>
      </div>
      {step === "email" ? (
        <div className="min-h-screen flex items-center justify-center bg-gray-100">
          <form
            onSubmit={handleSubmit}
            className="bg-white p-6 rounded-xl shadow-md w-full max-w-sm"
          >
            <h2 className="text-2xl font-bold mb-4 text-center">Đăng nhập</h2>

            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">Email</label>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full border border-gray-300 p-2 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            <button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-700 text-white p-2 rounded-lg transition"
            >
              Đăng nhập
            </button>
          </form>
        </div>
      ) : (
        <div>
          <form
            onSubmit={handleLogout}
            className="bg-white p-6 rounded-xl shadow-md w-full max-w-sm"
          >
            <h2 className="text-2xl font-bold mb-4 text-center">OTP</h2>

            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">
                INPUT OTP
                {isVerifyingOTP && <div>Loading</div>}
              </label>
              <input
                value={otp}
                onChange={(e) => setOTP(e.target.value)}
                className="w-full border border-gray-300 p-2 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            {error && <p className="text-red-500">{error}</p>}
          </form>
        </div>
      )}
    </>
  );
}

export default App;
