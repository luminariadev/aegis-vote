// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";

/**
 * @title AegisVote
 * @author luminariadev <rizkianuari83@gmail.com>
 * @notice Enterprise-grade decentralized voting protocol featuring multi-level RBAC,
 *         automated time-locks, Merkle tree voter proofs, and transparent quorum tracking.
 * @dev Inherits AccessControl for fine-grained permissions, ReentrancyGuard for
 *      reentrancy protection, and Pausable for circuit-breaker emergency administration.
 */
contract AegisVote is AccessControl, ReentrancyGuard, Pausable {
    bytes32 public constant OFFICER_ROLE = keccak256("OFFICER_ROLE");
    bytes32 public constant VOTER_ROLE = keccak256("VOTER_ROLE");

    enum ElectionStatus {
        Pending,
        Active,
        Ended,
        Paused
    }

    struct Candidate {
        uint256 id;
        string name;
        string manifesto;
        uint256 voteCount;
    }

    struct ElectionConfig {
        string title;
        string description;
        uint256 startTime;
        uint256 endTime;
        uint256 quorumBps; // In basis points (e.g., 5000 = 50.00%)
        uint256 totalVotersCount; // Estimated or registered electorate size
        bytes32 merkleRoot; // 0x0 if using direct on-chain VOTER_ROLE or open whitelist
        bool finalized;
    }

    ElectionConfig public election;
    uint256 public candidatesCount;
    uint256 public totalVotesCast;

    mapping(uint256 => Candidate) private _candidates;
    mapping(address => bool) public hasVoted;

    // Events
    event ElectionConfigured(
        string title,
        uint256 startTime,
        uint256 endTime,
        uint256 quorumBps,
        uint256 totalVotersCount,
        bytes32 merkleRoot
    );
    event CandidateRegistered(uint256 indexed candidateId, string name, string manifesto);
    event VoteCast(address indexed voter, uint256 indexed candidateId, uint256 timestamp);
    event VoterWhitelisted(address indexed voter);
    event VoterBatchWhitelisted(uint256 count);
    event MerkleRootUpdated(bytes32 indexed oldRoot, bytes32 indexed newRoot);
    event QuorumParametersUpdated(uint256 quorumBps, uint256 totalVotersCount);
    event ElectionFinalized(
        uint256 indexed winnerCandidateId,
        string winnerName,
        uint256 winnerVoteCount,
        bool quorumMet
    );

    // Custom errors for gas efficiency
    error ElectionNotActive(uint256 currentTime, uint256 startTime, uint256 endTime);
    error ElectionAlreadyStarted();
    error ElectionNotEnded(uint256 currentTime, uint256 endTime);
    error ElectionAlreadyFinalized();
    error InvalidTimeRange(uint256 startTime, uint256 endTime);
    error InvalidCandidateId(uint256 candidateId);
    error EmptyCandidateName();
    error AlreadyVoted(address voter);
    error NotEligibleVoter(address voter);
    error InvalidMerkleProof();
    error InvalidQuorumPercentage(uint256 bps);
    error ZeroRegisteredVoters();

    modifier onlyOfficer() {
        if (!hasRole(OFFICER_ROLE, msg.sender) && !hasRole(DEFAULT_ADMIN_ROLE, msg.sender)) {
            revert AccessControlUnauthorizedAccount(msg.sender, OFFICER_ROLE);
        }
        _;
    }

    /**
     * @notice Initializes AegisVote contract with election details and roles.
     * @param _title Election heading / title
     * @param _description Election manifesto or organizational context
     * @param _startTime Unix timestamp when voting opens
     * @param _endTime Unix timestamp when voting closes
     * @param _quorumBps Minimum voter turnout percentage in basis points (100 = 1%, 5000 = 50%)
     * @param _totalVotersCount Total expected eligible voters in electorate
     */
    constructor(
        string memory _title,
        string memory _description,
        uint256 _startTime,
        uint256 _endTime,
        uint256 _quorumBps,
        uint256 _totalVotersCount
    ) {
        if (_startTime >= _endTime) {
            revert InvalidTimeRange(_startTime, _endTime);
        }
        if (_quorumBps > 10000) {
            revert InvalidQuorumPercentage(_quorumBps);
        }

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(OFFICER_ROLE, msg.sender);
        _setRoleAdmin(OFFICER_ROLE, DEFAULT_ADMIN_ROLE);
        _setRoleAdmin(VOTER_ROLE, OFFICER_ROLE);

        election = ElectionConfig({
            title: _title,
            description: _description,
            startTime: _startTime,
            endTime: _endTime,
            quorumBps: _quorumBps,
            totalVotersCount: _totalVotersCount,
            merkleRoot: bytes32(0),
            finalized: false
        });

        emit ElectionConfigured(_title, _startTime, _endTime, _quorumBps, _totalVotersCount, bytes32(0));
    }

    /**
     * @notice Registers a new candidate for the election.
     * @dev Only OFFICER_ROLE can invoke, and only before voting startTime has elapsed.
     */
    function registerCandidate(
        string memory _name,
        string memory _manifesto
    ) external onlyOfficer {
        if (block.timestamp >= election.startTime) {
            revert ElectionAlreadyStarted();
        }
        if (bytes(_name).length == 0) {
            revert EmptyCandidateName();
        }

        candidatesCount++;
        _candidates[candidatesCount] = Candidate({
            id: candidatesCount,
            name: _name,
            manifesto: _manifesto,
            voteCount: 0
        });

        emit CandidateRegistered(candidatesCount, _name, _manifesto);
    }

    /**
     * @notice Reconfigures schedule or parameters before election commences.
     */
    function configureElection(
        string memory _title,
        string memory _description,
        uint256 _startTime,
        uint256 _endTime,
        uint256 _quorumBps,
        uint256 _totalVotersCount,
        bytes32 _merkleRoot
    ) external onlyOfficer {
        if (block.timestamp >= election.startTime) {
            revert ElectionAlreadyStarted();
        }
        if (_startTime >= _endTime) {
            revert InvalidTimeRange(_startTime, _endTime);
        }
        if (_quorumBps > 10000) {
            revert InvalidQuorumPercentage(_quorumBps);
        }

        election.title = _title;
        election.description = _description;
        election.startTime = _startTime;
        election.endTime = _endTime;
        election.quorumBps = _quorumBps;
        election.totalVotersCount = _totalVotersCount;
        election.merkleRoot = _merkleRoot;

        emit ElectionConfigured(_title, _startTime, _endTime, _quorumBps, _totalVotersCount, _merkleRoot);
    }

    /**
     * @notice Updates the Merkle Root for voter whitelist verification.
     */
    function setMerkleRoot(bytes32 _merkleRoot) external onlyOfficer {
        bytes32 old = election.merkleRoot;
        election.merkleRoot = _merkleRoot;
        emit MerkleRootUpdated(old, _merkleRoot);
    }

    /**
     * @notice Whitelists an individual voter by granting VOTER_ROLE.
     */
    function whitelistVoter(address _voter) external onlyOfficer {
        _grantRole(VOTER_ROLE, _voter);
        emit VoterWhitelisted(_voter);
    }

    /**
     * @notice Batch whitelists multiple voter addresses at once.
     */
    function batchWhitelistVoters(address[] calldata _voters) external onlyOfficer {
        for (uint256 i = 0; i < _voters.length; i++) {
            _grantRole(VOTER_ROLE, _voters[i]);
        }
        emit VoterBatchWhitelisted(_voters.length);
    }

    /**
     * @notice Casts vote directly using on-chain role eligibility or open whitelist.
     * @param _candidateId Candidate number to vote for.
     */
    function vote(uint256 _candidateId) external nonReentrant whenNotPaused {
        _validateElectionActive();
        if (hasVoted[msg.sender]) {
            revert AlreadyVoted(msg.sender);
        }
        if (_candidateId == 0 || _candidateId > candidatesCount) {
            revert InvalidCandidateId(_candidateId);
        }

        // If merkleRoot is set, direct vote is only allowed if sender has explicit VOTER_ROLE
        if (election.merkleRoot != bytes32(0)) {
            if (!hasRole(VOTER_ROLE, msg.sender)) {
                revert NotEligibleVoter(msg.sender);
            }
        } else {
            // When Merkle root is not set, sender must have VOTER_ROLE unless totalVotersCount is 0 (open demo)
            if (election.totalVotersCount > 0 && !hasRole(VOTER_ROLE, msg.sender)) {
                revert NotEligibleVoter(msg.sender);
            }
        }

        _executeVote(msg.sender, _candidateId);
    }

    /**
     * @notice Casts vote with cryptographic Merkle proof for voter privacy & gas efficiency.
     * @param _candidateId Candidate number to vote for.
     * @param _merkleProof Array of 32-byte hashes proving msg.sender is in the Merkle Tree.
     */
    function voteWithProof(
        uint256 _candidateId,
        bytes32[] calldata _merkleProof
    ) external nonReentrant whenNotPaused {
        _validateElectionActive();
        if (hasVoted[msg.sender]) {
            revert AlreadyVoted(msg.sender);
        }
        if (_candidateId == 0 || _candidateId > candidatesCount) {
            revert InvalidCandidateId(_candidateId);
        }
        if (election.merkleRoot == bytes32(0)) {
            revert InvalidMerkleProof();
        }

        bytes32 leaf = keccak256(bytes.concat(keccak256(abi.encode(msg.sender))));
        if (!MerkleProof.verify(_merkleProof, election.merkleRoot, leaf)) {
            revert InvalidMerkleProof();
        }

        _executeVote(msg.sender, _candidateId);
    }

    /**
     * @notice Internal helper to record vote and emit event.
     */
    function _executeVote(address _voter, uint256 _candidateId) internal {
        hasVoted[_voter] = true;
        _candidates[_candidateId].voteCount++;
        totalVotesCast++;

        emit VoteCast(_voter, _candidateId, block.timestamp);
    }

    /**
     * @notice Checks if election is within active time-lock bounds and not paused.
     */
    function _validateElectionActive() internal view {
        if (block.timestamp < election.startTime || block.timestamp > election.endTime) {
            revert ElectionNotActive(block.timestamp, election.startTime, election.endTime);
        }
    }

    /**
     * @notice Live check if voting is currently permitted.
     */
    function isElectionActive() public view returns (bool) {
        return (
            block.timestamp >= election.startTime &&
            block.timestamp <= election.endTime &&
            !paused()
        );
    }

    /**
     * @notice Returns standard election status enum.
     */
    function getElectionStatus() public view returns (ElectionStatus) {
        if (paused()) {
            return ElectionStatus.Paused;
        }
        if (block.timestamp < election.startTime) {
            return ElectionStatus.Pending;
        }
        if (block.timestamp <= election.endTime) {
            return ElectionStatus.Active;
        }
        return ElectionStatus.Ended;
    }

    /**
     * @notice Returns candidate details.
     */
    function getCandidate(uint256 _candidateId) external view returns (Candidate memory) {
        if (_candidateId == 0 || _candidateId > candidatesCount) {
            revert InvalidCandidateId(_candidateId);
        }
        return _candidates[_candidateId];
    }

    /**
     * @notice Returns list of all registered candidates.
     */
    function getAllCandidates() external view returns (Candidate[] memory) {
        Candidate[] memory list = new Candidate[](candidatesCount);
        for (uint256 i = 1; i <= candidatesCount; i++) {
            list[i - 1] = _candidates[i];
        }
        return list;
    }

    /**
     * @notice Evaluates quorum fulfillment and voter turnout metrics.
     * @return quorumReached Whether totalVotes meets minimum required quorum
     * @return turnoutBps Current turnout percentage in basis points (100 = 1%)
     * @return requiredQuorumBps Configured quorum requirement in basis points
     * @return votesCast Total votes recorded so far
     * @return requiredVotes Absolute minimum number of votes required for quorum
     */
    function getQuorumStatus()
        public
        view
        returns (
            bool quorumReached,
            uint256 turnoutBps,
            uint256 requiredQuorumBps,
            uint256 votesCast,
            uint256 requiredVotes
        )
    {
        requiredQuorumBps = election.quorumBps;
        votesCast = totalVotesCast;

        if (election.totalVotersCount == 0) {
            requiredVotes = 0;
            turnoutBps = 0;
            quorumReached = totalVotesCast > 0;
            return (quorumReached, turnoutBps, requiredQuorumBps, votesCast, requiredVotes);
        }

        requiredVotes = (election.totalVotersCount * election.quorumBps) / 10000;
        turnoutBps = (totalVotesCast * 10000) / election.totalVotersCount;
        quorumReached = totalVotesCast >= requiredVotes && totalVotesCast > 0;
    }

    /**
     * @notice Computes currently leading candidate or final winner.
     */
    function getLeadingCandidate()
        public
        view
        returns (
            uint256 winnerId,
            string memory winnerName,
            uint256 winnerVoteCount,
            bool quorumMet,
            bool isTie
        )
    {
        (quorumMet, , , , ) = getQuorumStatus();

        if (candidatesCount == 0) {
            return (0, "", 0, quorumMet, false);
        }

        uint256 highestVotes = 0;
        uint256 topCandidateId = 0;
        bool tie = false;

        for (uint256 i = 1; i <= candidatesCount; i++) {
            uint256 currentCount = _candidates[i].voteCount;
            if (currentCount > highestVotes) {
                highestVotes = currentCount;
                topCandidateId = i;
                tie = false;
            } else if (currentCount == highestVotes && highestVotes > 0) {
                tie = true;
            }
        }

        if (topCandidateId == 0) {
            return (0, "", 0, quorumMet, false);
        }

        return (
            topCandidateId,
            _candidates[topCandidateId].name,
            highestVotes,
            quorumMet,
            tie
        );
    }

    /**
     * @notice Finalizes the election once the time-lock window expires.
     */
    function finalizeElection() external onlyOfficer {
        if (block.timestamp <= election.endTime) {
            revert ElectionNotEnded(block.timestamp, election.endTime);
        }
        if (election.finalized) {
            revert ElectionAlreadyFinalized();
        }

        election.finalized = true;

        (
            uint256 winnerId,
            string memory winnerName,
            uint256 winnerVoteCount,
            bool quorumMet,

        ) = getLeadingCandidate();

        emit ElectionFinalized(winnerId, winnerName, winnerVoteCount, quorumMet);
    }

    /**
     * @notice Updates quorum parameters before election ends.
     */
    function updateQuorumParameters(
        uint256 _quorumBps,
        uint256 _totalVotersCount
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (_quorumBps > 10000) {
            revert InvalidQuorumPercentage(_quorumBps);
        }
        election.quorumBps = _quorumBps;
        election.totalVotersCount = _totalVotersCount;

        emit QuorumParametersUpdated(_quorumBps, _totalVotersCount);
    }

    /**
     * @notice Circuit-breaker emergency pause in case of anomalies.
     */
    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    /**
     * @notice Resumes contract execution after emergency investigation.
     */
    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }
}
