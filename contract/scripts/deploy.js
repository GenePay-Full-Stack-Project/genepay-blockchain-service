const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("🚀 Starting AuditLedger deployment...\n");

  // Get deployer account
  const [deployer] = await hre.ethers.getSigners();
  console.log("📝 Deploying contract with account:", deployer.address);

  // Check deployer balance
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("💰 Account balance:", hre.ethers.formatEther(balance), "ETH\n");

  // Deploy AuditLedger contract
  console.log("⏳ Deploying AuditLedger...");
  const AuditLedger = await hre.ethers.getContractFactory("AuditLedger");
  const auditLedger = await AuditLedger.deploy();
  
  await auditLedger.waitForDeployment();
  const contractAddress = await auditLedger.getAddress();

  console.log("✅ AuditLedger deployed to:", contractAddress);
  console.log("🔗 Network:", hre.network.name);
  console.log("⛽ Gas used:", (await auditLedger.deploymentTransaction()).gasLimit.toString());

  // Save deployment info
  const deploymentInfo = {
    network: hre.network.name,
    contractAddress: contractAddress,
    deployerAddress: deployer.address,
    deploymentTime: new Date().toISOString(),
    blockNumber: await hre.ethers.provider.getBlockNumber()
  };

  const deploymentPath = path.join(__dirname, "..", "deployments.json");
  let deployments = {};
  
  if (fs.existsSync(deploymentPath)) {
    deployments = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
  }
  
  deployments[hre.network.name] = deploymentInfo;
  fs.writeFileSync(deploymentPath, JSON.stringify(deployments, null, 2));

  console.log("\n📄 Deployment info saved to deployments.json");

  // Update .env file with contract address
  const envPath = path.join(__dirname, "..", ".env");
  if (fs.existsSync(envPath)) {
    let envContent = fs.readFileSync(envPath, "utf8");
    const addressRegex = /CONTRACT_ADDRESS=.*/;
    
    if (addressRegex.test(envContent)) {
      envContent = envContent.replace(addressRegex, `CONTRACT_ADDRESS=${contractAddress}`);
    } else {
      envContent += `\nCONTRACT_ADDRESS=${contractAddress}`;
    }
    
    fs.writeFileSync(envPath, envContent);
    console.log("📝 Updated .env with contract address");
  }

  // Verification instructions
  if (hre.network.name === "sepolia") {
    console.log("\n🔍 To verify the contract on Etherscan, run:");
    console.log(`npx hardhat verify --network sepolia ${contractAddress}`);
  }

  console.log("\n✨ Deployment complete!");
  console.log("━".repeat(60));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  });
