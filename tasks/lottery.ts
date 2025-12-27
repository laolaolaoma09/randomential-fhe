import { task } from "hardhat/config";
import type { TaskArguments } from "hardhat/types";

task("task:lottery-address", "Prints the TokenLottery address").setAction(async function (_taskArguments: TaskArguments, hre) {
  const { deployments } = hre;
  const lottery = await deployments.get("TokenLottery");
  console.log("TokenLottery address is", lottery.address);
});

task("task:lottery-tokens", "Lists all supported token addresses")
  .addOptionalParam("address", "Optionally specify the TokenLottery contract address")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { ethers, deployments } = hre;
    const lotteryDeployment = taskArguments.address
      ? { address: taskArguments.address as string }
      : await deployments.get("TokenLottery");

    const lotteryContract = await ethers.getContractAt("TokenLottery", lotteryDeployment.address);
    const supportedTokens: string[] = await lotteryContract.getSupportedTokens();

    console.log(`TokenLottery: ${lotteryDeployment.address}`);
    supportedTokens.forEach((tokenAddress: string, index: number) => {
      console.log(`  Token[${index}]: ${tokenAddress}`);
    });
  });

task("task:lottery-draw", "Executes a lottery draw")
  .addOptionalParam("address", "Optionally specify the TokenLottery contract address")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { deployments, ethers } = hre;
    const lotteryDeployment = taskArguments.address
      ? { address: taskArguments.address as string }
      : await deployments.get("TokenLottery");

    const [signer] = await ethers.getSigners();
    const lotteryContract = await ethers.getContractAt("TokenLottery", lotteryDeployment.address);

    console.log(`Calling draw() on TokenLottery: ${lotteryDeployment.address}`);
    const tx = await lotteryContract.connect(signer).draw();
    console.log(`Waiting for transaction ${tx.hash}...`);
    const receipt = await tx.wait();

    if (!receipt) {
      console.log("Transaction failed");
      return;
    }

    const rewardLog = receipt.logs
      .map((log) => {
        try {
          return lotteryContract.interface.parseLog(log);
        } catch (_error) {
          return null;
        }
      })
      .find((description) => description && description.name === "LotteryReward");

    if (rewardLog) {
      const player = rewardLog.args?.player as string;
      const token = rewardLog.args?.token as string;
      const amount = rewardLog.args?.amount as bigint;
      console.log(`LotteryReward => player: ${player}, token: ${token}, amount: ${amount.toString()}`);
    } else {
      console.log("LotteryReward event was not found in the transaction receipt");
    }
  });
