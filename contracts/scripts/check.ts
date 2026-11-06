import { ethers } from "hardhat";

async function main() {
  const contractAddress = process.env.CONTRACT_ADDRESS || "0x5FbDB2315678afecb367f032d93F642f64180aa3";
  console.log(`Inspecting AegisVote at: ${contractAddress}`);

  const AegisVoteFactory = await ethers.getContractFactory("AegisVote");
  const aegisVote: any = AegisVoteFactory.attach(contractAddress);

  try {
    const election = await aegisVote.election();
    const active = await aegisVote.isElectionActive();
    const count = await aegisVote.candidatesCount();
    const quorum = await aegisVote.getQuorumStatus();

    console.log("=== AegisVote State ===");
    console.log(`Title: ${election.title}`);
    console.log(`Is Active: ${active}`);
    console.log(`Candidates Count: ${count}`);
    console.log(`Votes Cast: ${quorum.votesCast} / Required: ${quorum.requiredVotes}`);
    console.log(`Quorum Reached: ${quorum.quorumReached} (${Number(quorum.turnoutBps) / 100}% turnout)`);
  } catch (e: any) {
    console.error("State query failed:", e.message || e);
  }
}

main().catch(console.error);
