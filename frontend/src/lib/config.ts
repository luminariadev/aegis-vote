export const CONTRACT_ADDRESS = "0x5FbDB2315678afecb367f032d93F642f64180aa3";

export const DEFAULT_ADMIN_ROLE = "0x0000000000000000000000000000000000000000000000000000000000000000";
// keccak256("OFFICER_ROLE")
export const OFFICER_ROLE = "0x4f4646494345525f524f4c450000000000000000000000000000000000000000"; // computed dynamically or queried
// keccak256("VOTER_ROLE")
export const VOTER_ROLE = "0x564f5445525f524f4c4500000000000000000000000000000000000000000000";

export const CONTRACT_ABI = [
  "function election() view returns (string title, string description, uint256 startTime, uint256 endTime, uint256 quorumBps, uint256 totalVotersCount, bytes32 merkleRoot, bool finalized)",
  "function candidatesCount() view returns (uint256)",
  "function totalVotesCast() view returns (uint256)",
  "function hasVoted(address voter) view returns (bool)",
  "function isElectionActive() view returns (bool)",
  "function getElectionStatus() view returns (uint8)",
  "function getCandidate(uint256 _candidateId) view returns (tuple(uint256 id, string name, string manifesto, uint256 voteCount))",
  "function getAllCandidates() view returns (tuple(uint256 id, string name, string manifesto, uint256 voteCount)[])",
  "function getQuorumStatus() view returns (bool quorumReached, uint256 turnoutBps, uint256 requiredQuorumBps, uint256 votesCast, uint256 requiredVotes)",
  "function getLeadingCandidate() view returns (uint256 winnerId, string winnerName, uint256 winnerVoteCount, bool quorumMet, bool isTie)",
  "function hasRole(bytes32 role, address account) view returns (bool)",
  "function DEFAULT_ADMIN_ROLE() view returns (bytes32)",
  "function OFFICER_ROLE() view returns (bytes32)",
  "function VOTER_ROLE() view returns (bytes32)",
  "function paused() view returns (bool)",
  "function registerCandidate(string _name, string _manifesto)",
  "function configureElection(string _title, string _description, uint256 _startTime, uint256 _endTime, uint256 _quorumBps, uint256 _totalVotersCount, bytes32 _merkleRoot)",
  "function setMerkleRoot(bytes32 _merkleRoot)",
  "function whitelistVoter(address _voter)",
  "function batchWhitelistVoters(address[] _voters)",
  "function vote(uint256 _candidateId)",
  "function voteWithProof(uint256 _candidateId, bytes32[] _merkleProof)",
  "function finalizeElection()",
  "function pause()",
  "function unpause()",
  "event ElectionConfigured(string title, uint256 startTime, uint256 endTime, uint256 quorumBps, uint256 totalVotersCount, bytes32 merkleRoot)",
  "event CandidateRegistered(uint256 indexed candidateId, string name, string manifesto)",
  "event VoteCast(address indexed voter, uint256 indexed candidateId, uint256 timestamp)",
  "event VoterWhitelisted(address indexed voter)",
  "event VoterBatchWhitelisted(uint256 count)",
  "event MerkleRootUpdated(bytes32 indexed oldRoot, bytes32 indexed newRoot)",
  "event ElectionFinalized(uint256 indexed winnerCandidateId, string winnerName, uint256 winnerVoteCount, bool quorumMet)"
];
