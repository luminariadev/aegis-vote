import { ethers } from "hardhat";

async function main() {
  console.log("==================================================");
  console.log("   🛡️  AEGISVOTE PROTOCOL - SMART CONTRACT DEPLOYMENT ");
  console.log("==================================================");

  const [deployer] = await ethers.getSigners();
  console.log(`Deploying with account: ${deployer.address}`);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`Account balance: ${ethers.formatEther(balance)} ETH`);

  // Election Parameters
  const title = "Aegis Decentralized Governance Council 2026";
  const description =
    "Institutional cryptographic ballot for protocol governance delegates with automated time-locks and RBAC.";
  
  // Start election immediately, duration 7 days
  const currentBlock = await ethers.provider.getBlock("latest");
  const currentTime = currentBlock ? currentBlock.timestamp : Math.floor(Date.now() / 1000);
  const startTime = currentTime + 60; // Voting opens in 1 minute
  const endTime = startTime + 7 * 24 * 3600; // 7 days voting window
  const quorumBps = 5000; // 50.00% quorum required
  const totalVotersCount = 10; // Demo electorate size

  console.log(`Title: ${title}`);
  console.log(`Start Time: ${new Date(startTime * 1000).toISOString()}`);
  console.log(`End Time: ${new Date(endTime * 1000).toISOString()}`);
  console.log(`Quorum: ${quorumBps / 100}%`);
  console.log(`Electorate Size: ${totalVotersCount} registered voters`);

  const AegisVoteFactory = await ethers.getContractFactory("AegisVote");
  const aegisVote = await AegisVoteFactory.deploy(
    title,
    description,
    startTime,
    endTime,
    quorumBps,
    totalVotersCount
  );

  await aegisVote.waitForDeployment();
  const contractAddress = await aegisVote.getAddress();

  console.log("--------------------------------------------------");
  console.log(`✅ AegisVote successfully deployed at: ${contractAddress}`);
  console.log("--------------------------------------------------");

  // Register demo candidates
  console.log("Registering initial candidates...");
  await aegisVote.registerCandidate(
    "Dr. Alice Nakamoto",
    "Pioneering cryptographic zero-knowledge systems, consensus security, and decentralized scaling."
  );
  await aegisVote.registerCandidate(
    "Prof. Bob Vitalik",
    "Advancing distributed state machines, gas optimization, and institutional governance interoperability."
  );
  await aegisVote.registerCandidate(
    "Charlie Hoskinson",
    "Focusing on formal contract verification, peer-reviewed distributed systems, and verifiable random ballots."
  );

  console.log(`Registered 3 candidates for ${title}.`);
  console.log("Deployment and setup complete!");
}

main().catch((error) => {
  console.error("Deployment failed:", error);
  process.exitCode = 1;
});
