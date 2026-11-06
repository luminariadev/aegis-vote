import { ethers } from "hardhat";

async function main() {
  const contractAddress = process.env.CONTRACT_ADDRESS || "0x5FbDB2315678afecb367f032d93F642f64180aa3";
  console.log(`Connecting to AegisVote at: ${contractAddress}`);

  const AegisVoteFactory = await ethers.getContractFactory("AegisVote");
  const aegisVote: any = AegisVoteFactory.attach(contractAddress);

  const signers = await ethers.getSigners();
  const officer = signers[0];

  console.log(`Whitelisting accounts 1 through 5 as voters...`);
  const voters = signers.slice(1, 6).map((s) => s.address);
  const tx = await aegisVote.connect(officer).batchWhitelistVoters(voters);
  await tx.wait();

  console.log(`Successfully whitelisted ${voters.length} accounts:`, voters);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
