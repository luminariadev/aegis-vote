import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { MerkleTree } from "merkletreejs";
import keccak256 from "keccak256";

describe("AegisVote Protocol", function () {
  async function deployAegisFixture() {
    const [admin, officer, voter1, voter2, voter3, unverified] = await ethers.getSigners();

    const latestTime = await time.latest();
    const startTime = latestTime + 100; // starts in 100 seconds
    const endTime = startTime + 3600; // runs for 1 hour
    const quorumBps = 5000; // 50.00%
    const totalVotersCount = 4;

    const AegisVoteFactory = await ethers.getContractFactory("AegisVote");
    const aegisVote = await AegisVoteFactory.deploy(
      "Decentralized Governance Council 2026",
      "Institutional ballot for distributed protocol delegates",
      startTime,
      endTime,
      quorumBps,
      totalVotersCount
    );

    // Grant officer role
    const OFFICER_ROLE = await aegisVote.OFFICER_ROLE();
    const VOTER_ROLE = await aegisVote.VOTER_ROLE();
    await aegisVote.grantRole(OFFICER_ROLE, officer.address);

    return {
      aegisVote,
      admin,
      officer,
      voter1,
      voter2,
      voter3,
      unverified,
      startTime,
      endTime,
      quorumBps,
      totalVotersCount,
      OFFICER_ROLE,
      VOTER_ROLE,
    };
  }

  describe("Deployment & RBAC Configuration", function () {
    it("Should grant DEFAULT_ADMIN_ROLE and OFFICER_ROLE to deployer", async function () {
      const { aegisVote, admin, officer, OFFICER_ROLE } = await deployAegisFixture();
      const DEFAULT_ADMIN = await aegisVote.DEFAULT_ADMIN_ROLE();

      expect(await aegisVote.hasRole(DEFAULT_ADMIN, admin.address)).to.be.true;
      expect(await aegisVote.hasRole(OFFICER_ROLE, admin.address)).to.be.true;
      expect(await aegisVote.hasRole(OFFICER_ROLE, officer.address)).to.be.true;
    });

    it("Should correctly initialize election parameters", async function () {
      const { aegisVote, startTime, endTime, quorumBps, totalVotersCount } = await deployAegisFixture();
      const config = await aegisVote.election();

      expect(config.title).to.equal("Decentralized Governance Council 2026");
      expect(config.startTime).to.equal(startTime);
      expect(config.endTime).to.equal(endTime);
      expect(config.quorumBps).to.equal(quorumBps);
      expect(config.totalVotersCount).to.equal(totalVotersCount);
      expect(config.finalized).to.be.false;
    });

    it("Should reject invalid time range during deployment", async function () {
      const latestTime = await time.latest();
      const AegisVoteFactory = await ethers.getContractFactory("AegisVote");

      await expect(
        AegisVoteFactory.deploy("Test", "Desc", latestTime + 1000, latestTime + 500, 5000, 10)
      ).to.be.revertedWithCustomError(AegisVoteFactory, "InvalidTimeRange");
    });
  });

  describe("Candidate Registration", function () {
    it("Should allow officer to register candidates before startTime", async function () {
      const { aegisVote, officer } = await deployAegisFixture();

      await aegisVote.connect(officer).registerCandidate("Alice Nakamoto", "Security & Layer-1 Decentralization");
      await aegisVote.connect(officer).registerCandidate("Bob Vitalik", "Scalability & Zero-Knowledge Systems");

      expect(await aegisVote.candidatesCount()).to.equal(2);

      const candidate1 = await aegisVote.getCandidate(1);
      expect(candidate1.name).to.equal("Alice Nakamoto");
      expect(candidate1.manifesto).to.equal("Security & Layer-1 Decentralization");
      expect(candidate1.voteCount).to.equal(0);
    });

    it("Should revert if unauthorized account tries to register candidates", async function () {
      const { aegisVote, unverified } = await deployAegisFixture();

      await expect(
        aegisVote.connect(unverified).registerCandidate("Charlie", "Manifesto")
      ).to.be.revertedWithCustomError(aegisVote, "AccessControlUnauthorizedAccount");
    });

    it("Should reject registration with empty candidate name", async function () {
      const { aegisVote, officer } = await deployAegisFixture();

      await expect(
        aegisVote.connect(officer).registerCandidate("", "Empty Name")
      ).to.be.revertedWithCustomError(aegisVote, "EmptyCandidateName");
    });

    it("Should reject candidate registration once election has started", async function () {
      const { aegisVote, officer, startTime } = await deployAegisFixture();

      await time.increaseTo(startTime + 10);

      await expect(
        aegisVote.connect(officer).registerCandidate("Late Candidate", "Too late")
      ).to.be.revertedWithCustomError(aegisVote, "ElectionAlreadyStarted");
    });
  });

  describe("Time-Lock Enforcement & Direct Whitelist Voting", function () {
    it("Should revert votes cast before election starts", async function () {
      const { aegisVote, officer, voter1 } = await deployAegisFixture();

      await aegisVote.connect(officer).registerCandidate("Alice", "Manifesto");
      await aegisVote.connect(officer).whitelistVoter(voter1.address);

      await expect(
        aegisVote.connect(voter1).vote(1)
      ).to.be.revertedWithCustomError(aegisVote, "ElectionNotActive");
    });

    it("Should allow whitelisted voter to cast vote during active window", async function () {
      const { aegisVote, officer, voter1, startTime } = await deployAegisFixture();

      await aegisVote.connect(officer).registerCandidate("Alice", "Manifesto");
      await aegisVote.connect(officer).whitelistVoter(voter1.address);

      await time.increaseTo(startTime + 1);

      await expect(aegisVote.connect(voter1).vote(1))
        .to.emit(aegisVote, "VoteCast");

      expect(await aegisVote.hasVoted(voter1.address)).to.be.true;
      expect(await aegisVote.totalVotesCast()).to.equal(1);

      const candidate = await aegisVote.getCandidate(1);
      expect(candidate.voteCount).to.equal(1);
    });

    it("Should prevent double voting from the same address", async function () {
      const { aegisVote, officer, voter1, startTime } = await deployAegisFixture();

      await aegisVote.connect(officer).registerCandidate("Alice", "Manifesto");
      await aegisVote.connect(officer).whitelistVoter(voter1.address);

      await time.increaseTo(startTime + 1);

      await aegisVote.connect(voter1).vote(1);

      await expect(
        aegisVote.connect(voter1).vote(1)
      ).to.be.revertedWithCustomError(aegisVote, "AlreadyVoted");
    });

    it("Should reject non-whitelisted voters", async function () {
      const { aegisVote, officer, unverified, startTime } = await deployAegisFixture();

      await aegisVote.connect(officer).registerCandidate("Alice", "Manifesto");

      await time.increaseTo(startTime + 1);

      await expect(
        aegisVote.connect(unverified).vote(1)
      ).to.be.revertedWithCustomError(aegisVote, "NotEligibleVoter");
    });

    it("Should reject voting once endTime has passed", async function () {
      const { aegisVote, officer, voter1, startTime, endTime } = await deployAegisFixture();

      await aegisVote.connect(officer).registerCandidate("Alice", "Manifesto");
      await aegisVote.connect(officer).whitelistVoter(voter1.address);

      await time.increaseTo(endTime + 10);

      await expect(
        aegisVote.connect(voter1).vote(1)
      ).to.be.revertedWithCustomError(aegisVote, "ElectionNotActive");
    });
  });

  describe("Merkle Tree Proof Cryptographic Voting", function () {
    function generateLeaf(address: string) {
      const encoded = ethers.AbiCoder.defaultAbiCoder().encode(["address"], [address]);
      const innerHash = keccak256(encoded);
      return keccak256(innerHash);
    }

    it("Should allow valid Merkle proof voter to cast vote", async function () {
      const { aegisVote, officer, voter1, voter2, voter3, unverified, startTime } =
        await deployAegisFixture();

      await aegisVote.connect(officer).registerCandidate("Alice", "Manifesto");

      // Generate Merkle Tree for voter1, voter2, voter3
      const eligibleAddresses = [voter1.address, voter2.address, voter3.address];
      const leaves = eligibleAddresses.map((addr) => generateLeaf(addr));
      const merkleTree = new MerkleTree(leaves, keccak256, { sortPairs: true });
      const root = merkleTree.getHexRoot();

      await aegisVote.connect(officer).setMerkleRoot(root);

      await time.increaseTo(startTime + 1);

      // voter1 proves eligibility
      const leaf1 = generateLeaf(voter1.address);
      const proof1 = merkleTree.getHexProof(leaf1);

      await expect(aegisVote.connect(voter1).voteWithProof(1, proof1))
        .to.emit(aegisVote, "VoteCast");

      expect(await aegisVote.hasVoted(voter1.address)).to.be.true;

      // Unverified user attempts to use fraudulent proof
      const fakeLeaf = generateLeaf(unverified.address);
      const fakeProof = merkleTree.getHexProof(fakeLeaf);

      await expect(
        aegisVote.connect(unverified).voteWithProof(1, fakeProof)
      ).to.be.revertedWithCustomError(aegisVote, "InvalidMerkleProof");
    });
  });

  describe("Quorum Calculation & Tabulation", function () {
    it("Should accurately track quorum threshold and identify winner", async function () {
      const { aegisVote, officer, voter1, voter2, voter3, startTime, endTime } =
        await deployAegisFixture();

      await aegisVote.connect(officer).registerCandidate("Alice", "Manifesto 1");
      await aegisVote.connect(officer).registerCandidate("Bob", "Manifesto 2");

      await aegisVote.connect(officer).batchWhitelistVoters([voter1.address, voter2.address, voter3.address]);

      await time.increaseTo(startTime + 1);

      // Initial quorum state (0 votes cast out of 4 expected, quorum is 50% = 2 votes)
      let quorumStatus = await aegisVote.getQuorumStatus();
      expect(quorumStatus.quorumReached).to.be.false;
      expect(quorumStatus.requiredVotes).to.equal(2);

      // Voter 1 votes for Alice
      await aegisVote.connect(voter1).vote(1);
      quorumStatus = await aegisVote.getQuorumStatus();
      expect(quorumStatus.quorumReached).to.be.false;

      // Voter 2 votes for Alice (Total 2 votes -> meets 50% quorum!)
      await aegisVote.connect(voter2).vote(1);
      quorumStatus = await aegisVote.getQuorumStatus();
      expect(quorumStatus.quorumReached).to.be.true;
      expect(quorumStatus.turnoutBps).to.equal(5000);

      // Check leading candidate
      const leading = await aegisVote.getLeadingCandidate();
      expect(leading.winnerName).to.equal("Alice");
      expect(leading.winnerVoteCount).to.equal(2);
      expect(leading.quorumMet).to.be.true;
      expect(leading.isTie).to.be.false;

      // Finalize election after endTime
      await time.increaseTo(endTime + 1);
      await expect(aegisVote.connect(officer).finalizeElection())
        .to.emit(aegisVote, "ElectionFinalized")
        .withArgs(1, "Alice", 2, true);

      const config = await aegisVote.election();
      expect(config.finalized).to.be.true;
    });
  });

  describe("Circuit Breaker & Emergency Controls", function () {
    it("Should pause and prevent voting during emergency", async function () {
      const { aegisVote, admin, officer, voter1, startTime } = await deployAegisFixture();

      await aegisVote.connect(officer).registerCandidate("Alice", "Manifesto");
      await aegisVote.connect(officer).whitelistVoter(voter1.address);

      await time.increaseTo(startTime + 1);

      // Admin pauses contract
      await aegisVote.connect(admin).pause();

      await expect(
        aegisVote.connect(voter1).vote(1)
      ).to.be.revertedWithCustomError(aegisVote, "EnforcedPause");

      // Admin unpauses
      await aegisVote.connect(admin).unpause();
      await expect(aegisVote.connect(voter1).vote(1)).to.emit(aegisVote, "VoteCast");
    });
  });
});
