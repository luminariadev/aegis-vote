import { ethers } from "hardhat";

async function main() {
  const contractAddress = "0x5FbDB2315678afecb367f032d93F642f64180aa3";
  const AegisVoteFactory = await ethers.getContractFactory("AegisVote");
  const aegisVote: any = AegisVoteFactory.attach(contractAddress);

  const signers = await ethers.getSigners();
  console.log("Casting sample votes to demonstrate quorum and tabulation...");

  // Account 1 votes for Alice (Candidate 1)
  await aegisVote.connect(signers[1]).vote(1);
  console.log(`Account 1 (${signers[1].address.slice(0, 8)}...) voted for Candidate #1`);

  // Account 2 votes for Alice (Candidate 1)
  await aegisVote.connect(signers[2]).vote(1);
  console.log(`Account 2 (${signers[2].address.slice(0, 8)}...) voted for Candidate #1`);

  // Account 3 votes for Bob (Candidate 2)
  await aegisVote.connect(signers[3]).vote(2);
  console.log(`Account 3 (${signers[3].address.slice(0, 8)}...) voted for Candidate #2`);

  // Account 4 votes for Alice (Candidate 1)
  await aegisVote.connect(signers[4]).vote(1);
  console.log(`Account 4 (${signers[4].address.slice(0, 8)}...) voted for Candidate #1`);

  // Account 5 votes for Charlie (Candidate 3)
  await aegisVote.connect(signers[5]).vote(3);
  console.log(`Account 5 (${signers[5].address.slice(0, 8)}...) voted for Candidate #3`);

  const quorum = await aegisVote.getQuorumStatus();
  console.log("--------------------------------------------------");
  console.log(`Total Votes Cast: ${quorum.votesCast} / Required: ${quorum.requiredVotes}`);
  console.log(`Turnout: ${Number(quorum.turnoutBps) / 100}%`);
  console.log(`Quorum Met: ${quorum.quorumReached}`);

  const leading = await aegisVote.getLeadingCandidate();
  console.log(`Current Winner: ${leading.winnerName} with ${leading.winnerVoteCount} votes!`);
  console.log("--------------------------------------------------");
}

main().catch(console.error);
