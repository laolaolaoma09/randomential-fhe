import { expect } from "chai";
import { ethers, fhevm } from "hardhat";
import { FhevmType } from "@fhevm/hardhat-plugin";
import { Contract, ContractFactory } from "ethers";

async function deployToken(name: string): Promise<Contract> {
  const factory: ContractFactory = await ethers.getContractFactory(name);
  const contract = await factory.deploy();
  await contract.waitForDeployment();
  return contract;
}

describe("TokenLottery", function () {
  const tokenNames = ["ERC7984USDT", "ERC7984USDC", "ERC7984DAI", "ERC7984WBTC", "ERC7984LINK"];
  let tokens: Contract[];
  let lottery: Contract;

  beforeEach(async function () {
    if (!fhevm.isMock) {
      console.warn("This hardhat test suite cannot run on Sepolia Testnet");
      this.skip();
    }

    tokens = await Promise.all(tokenNames.map((tokenName) => deployToken(tokenName)));

    const tokenAddresses = tokens.map((token) => token.target as string);
    const lotteryFactory: ContractFactory = await ethers.getContractFactory("TokenLottery");
    lottery = await lotteryFactory.deploy(tokenAddresses);
    await lottery.waitForDeployment();
  });

  it("stores the supported token addresses", async function () {
    const expectedAddresses = tokens.map((token) => token.target as string);
    const supportedAddresses = await lottery.getSupportedTokens();
    expect(supportedAddresses).to.deep.equal(expectedAddresses);

    const tokenCount = await lottery.getTokenCount();
    expect(tokenCount).to.equal(expectedAddresses.length);
  });

  it("draw mints a random token amount between 1 and 100", async function () {
    const [, player] = await ethers.getSigners();

    const tx = await lottery.connect(player).draw();
    const receipt = await tx.wait();
    if (!receipt) {
      throw new Error("Lottery draw transaction failed");
    }

    const parsedRewardLog = receipt.logs
      .map((log) => {
        try {
          return lottery.interface.parseLog(log);
        } catch (error) {
          return null;
        }
      })
      .find((log) => log && log.name === "LotteryReward");

    if (!parsedRewardLog) {
      throw new Error("LotteryReward event was not emitted");
    }

    const rewardedTokenAddress = parsedRewardLog.args?.token as string;
    const rewardedAmount = parsedRewardLog.args?.amount as bigint;

    const isSupportedToken = tokens.some((token) => token.target === rewardedTokenAddress);
    expect(isSupportedToken).to.equal(true);
    expect(rewardedAmount).to.be.gte(1n);
    expect(rewardedAmount).to.be.lte(100n);

    const rewardedToken = tokens.find((token) => token.target === rewardedTokenAddress);
    if (!rewardedToken) {
      throw new Error("Unable to match rewarded token");
    }

    const encryptedBalance = await rewardedToken.confidentialBalanceOf(player.address);
    const decryptedBalance = await fhevm.userDecryptEuint(
      FhevmType.euint64,
      encryptedBalance,
      rewardedToken.target as string,
      player,
    );

    expect(BigInt(decryptedBalance)).to.equal(rewardedAmount);
  });

  it("reverts when deploying without token addresses", async function () {
    const lotteryFactory: ContractFactory = await ethers.getContractFactory("TokenLottery");
    await expect(lotteryFactory.deploy([])).to.be.revertedWith("TokenLottery: token list is empty");
  });
});
