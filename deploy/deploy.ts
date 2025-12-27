import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;

  const tokenContracts = [
    "ERC7984USDT",
    "ERC7984USDC",
    "ERC7984DAI",
    "ERC7984WBTC",
    "ERC7984LINK",
  ];

  const deployedTokens: string[] = [];

  for (const name of tokenContracts) {
    const deployment = await deploy(name, {
      from: deployer,
      log: true,
      skipIfAlreadyDeployed: true,
    });

    const status = deployment.newlyDeployed ? "deployed" : "reused";
    console.log(`${name} contract (${status}):`, deployment.address);

    deployedTokens.push(deployment.address);
  }

  const deployedLottery = await deploy("TokenLottery", {
    from: deployer,
    args: [deployedTokens],
    log: true,
    skipIfAlreadyDeployed: true,
  });

  const lotteryStatus = deployedLottery.newlyDeployed ? "deployed" : "reused";
  console.log(`TokenLottery contract (${lotteryStatus}):`, deployedLottery.address);

  // const deployedFHECounter = await deploy("FHECounter", {
  //   from: deployer,
  //   log: true,
  // });

  // console.log(`FHECounter contract:`, deployedFHECounter.address);
};
export default func;
func.id = "deploy_tokens_lottery"; // id required to prevent reexecution
func.tags = ["Tokens", "Lottery", "FHECounter"];
