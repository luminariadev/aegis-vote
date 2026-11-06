<script lang="ts">
	import AegisButton from '$lib/components/AegisButton.svelte';
	import AegisCard from '$lib/components/AegisCard.svelte';
	import AegisBadge from '$lib/components/AegisBadge.svelte';
	import TimeCountdown from '$lib/components/TimeCountdown.svelte';
	import QuorumGauge from '$lib/components/QuorumGauge.svelte';
	import OfficerPanel from '$lib/components/OfficerPanel.svelte';

	import {
		walletAddress,
		connectWallet,
		disconnectWallet,
		isConnecting,
		signer,
		provider,
		chainId,
		isAdmin,
		isOfficer,
		isVoter,
		userHasVoted,
		checkUserRoles
	} from '$lib/stores/walletStore';
	import { CONTRACT_ADDRESS, CONTRACT_ABI } from '$lib/config';
	import { Contract, JsonRpcProvider } from 'ethers';
	import { onMount } from 'svelte';

	interface CandidateItem {
		id: number;
		name: string;
		manifesto: string;
		voteCount: number;
	}

	interface ElectionDetails {
		title: string;
		description: string;
		startTime: number;
		endTime: number;
		quorumBps: number;
		totalVotersCount: number;
		merkleRoot: string;
		finalized: boolean;
	}

	let candidates = $state<CandidateItem[]>([]);
	let election = $state<ElectionDetails>({
		title: 'Loading Protocol Data...',
		description: 'Connecting to decentralized node...',
		startTime: 0,
		endTime: 0,
		quorumBps: 5000,
		totalVotersCount: 0,
		merkleRoot: '0x0',
		finalized: false
	});

	let quorumData = $state({
		quorumReached: false,
		turnoutBps: 0,
		requiredQuorumBps: 5000,
		votesCast: 0,
		requiredVotes: 0
	});

	let leading = $state({
		winnerId: 0,
		winnerName: '',
		winnerVoteCount: 0,
		quorumMet: false,
		isTie: false
	});

	let isElectionActive = $state(false);
	let isContractPaused = $state(false);
	let selectedCandidateId = $state<number | null>(null);
	let txStatus = $state<{ text: string; type: 'info' | 'success' | 'error' } | null>(null);
	let isVoting = $state(false);
	let activeTab = $state<'ballot' | 'results' | 'governance'>('ballot');

	function formatAddress(address: string) {
		return `${address.slice(0, 6)}...${address.slice(-4)}`;
	}

	let totalVotes = $derived(candidates.reduce((acc, c) => acc + c.voteCount, 0));

	async function loadBlockchainData() {
		let activeProv: any = $provider;
		if (!activeProv) {
			try {
				activeProv = new JsonRpcProvider('http://127.0.0.1:8545');
			} catch (err) {
				console.warn('Fallback JSON-RPC provider unavailable:', err);
				return;
			}
		}

		try {
			const contract = new Contract(CONTRACT_ADDRESS, CONTRACT_ABI, activeProv);

			const [elecRaw, activeRaw, pausedRaw, countRaw, quorumRaw, leadRaw] = await Promise.all([
				contract.election(),
				contract.isElectionActive(),
				contract.paused().catch(() => false),
				contract.candidatesCount(),
				contract.getQuorumStatus(),
				contract.getLeadingCandidate()
			]);

			election = {
				title: elecRaw.title,
				description: elecRaw.description,
				startTime: Number(elecRaw.startTime),
				endTime: Number(elecRaw.endTime),
				quorumBps: Number(elecRaw.quorumBps),
				totalVotersCount: Number(elecRaw.totalVotersCount),
				merkleRoot: elecRaw.merkleRoot,
				finalized: elecRaw.finalized
			};

			isElectionActive = Boolean(activeRaw);
			isContractPaused = Boolean(pausedRaw);

			quorumData = {
				quorumReached: Boolean(quorumRaw.quorumReached),
				turnoutBps: Number(quorumRaw.turnoutBps),
				requiredQuorumBps: Number(quorumRaw.requiredQuorumBps),
				votesCast: Number(quorumRaw.votesCast),
				requiredVotes: Number(quorumRaw.requiredVotes)
			};

			leading = {
				winnerId: Number(leadRaw.winnerId),
				winnerName: leadRaw.winnerName,
				winnerVoteCount: Number(leadRaw.winnerVoteCount),
				quorumMet: Boolean(leadRaw.quorumMet),
				isTie: Boolean(leadRaw.isTie)
			};

			const loadedCandidates: CandidateItem[] = [];
			const count = Number(countRaw);
			for (let i = 1; i <= count; i++) {
				const c = await contract.getCandidate(i);
				loadedCandidates.push({
					id: Number(c.id),
					name: c.name,
					manifesto: c.manifesto || '',
					voteCount: Number(c.voteCount)
				});
			}
			candidates = loadedCandidates;

			if ($walletAddress) {
				await checkUserRoles($walletAddress, $provider);
			}
		} catch (e: any) {
			console.error('Failed to sync AegisVote data:', e);
			txStatus = {
				text: `Node sync warning: ${e.reason || e.message || 'Make sure Hardhat node is running'}`,
				type: 'error'
			};
		}
	}

	async function castVote() {
		if (!$signer || selectedCandidateId === null) return;
		isVoting = true;
		txStatus = { text: 'Awaiting signature from your Web3 wallet...', type: 'info' };

		try {
			const contract = new Contract(CONTRACT_ADDRESS, CONTRACT_ABI, $signer);
			const tx = await contract.vote(selectedCandidateId);
			txStatus = { text: 'Mining cryptographic transaction on-chain...', type: 'info' };
			await tx.wait();
			txStatus = { text: 'Vote cast and verified successfully! Your ballot is now immutable.', type: 'success' };
			selectedCandidateId = null;
			await loadBlockchainData();
		} catch (e: any) {
			console.error('Vote failed:', e);
			txStatus = { text: 'Transaction failed: ' + (e.reason || e.message), type: 'error' };
		} finally {
			isVoting = false;
		}
	}

	onMount(() => {
		loadBlockchainData();
	});

	$effect(() => {
		if ($provider) {
			loadBlockchainData();
		}
	});
</script>

<svelte:head>
	<title>AegisVote | Institutional Decentralized Ballot Protocol</title>
</svelte:head>

<div class="min-h-screen bg-aegis-bg text-slate-100 flex flex-col font-sans selection:bg-emerald-500/30 selection:text-emerald-300">
	<!-- Top Navigation -->
	<header class="border-b border-slate-800/80 bg-slate-950/70 backdrop-blur-xl sticky top-0 z-50">
		<div class="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
			<!-- Brand Identity -->
			<div class="flex items-center gap-3">
				<div class="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 via-teal-500 to-cyan-400 p-[1px] shadow-aegis-glow">
					<div class="w-full h-full bg-slate-950 rounded-xl flex items-center justify-center">
						<svg class="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
						</svg>
					</div>
				</div>
				<div>
					<div class="flex items-center gap-2">
						<span class="text-xl font-black tracking-tight text-white">AEGIS<span class="text-emerald-400 font-light">VOTE</span></span>
						<AegisBadge variant="emerald" size="sm">Enterprise v2.0</AegisBadge>
					</div>
					<p class="text-[11px] text-slate-400 font-mono tracking-wider uppercase">Cryptographic Governance Protocol</p>
				</div>
			</div>

			<!-- User & Wallet Actions -->
			<div class="flex items-center gap-4">
				{#if $walletAddress}
					<!-- Role Indicator -->
					<div class="hidden sm:flex items-center gap-2">
						{#if $isAdmin}
							<AegisBadge variant="violet">Super Admin</AegisBadge>
						{:else if $isOfficer}
							<AegisBadge variant="cyan">Election Officer</AegisBadge>
						{:else if $isVoter}
							<AegisBadge variant="emerald">Whitelisted Voter</AegisBadge>
						{:else}
							<AegisBadge variant="neutral">Unverified Electorate</AegisBadge>
						{/if}

						{#if $chainId}
							<span class="font-mono text-xs px-2.5 py-1 rounded-md bg-slate-900 border border-slate-800 text-slate-400">
								Chain: {$chainId === 31337 ? 'Hardhat Local' : $chainId}
							</span>
						{/if}
					</div>

					<div class="flex items-center gap-2 bg-slate-900/90 border border-slate-800 rounded-xl p-1.5 pl-3">
						<span class="font-mono text-xs font-semibold text-slate-300">
							{formatAddress($walletAddress)}
						</span>
						<AegisButton variant="ghost" size="sm" onclick={disconnectWallet}>
							Disconnect
						</AegisButton>
					</div>
				{:else}
					<AegisButton variant="cyan" size="md" onclick={connectWallet} loading={$isConnecting}>
						Connect Web3 Wallet
					</AegisButton>
				{/if}
			</div>
		</div>
	</header>

	<!-- Main Workspace -->
	<main class="flex-1 max-w-7xl mx-auto px-6 py-8 w-full flex flex-col gap-8">
		<!-- Election Hero Section -->
		<section class="rounded-3xl bg-gradient-to-br from-slate-900 via-slate-900/90 to-slate-950 border border-slate-800/90 p-8 shadow-aegis-card relative overflow-hidden">
			<div class="absolute -right-20 -top-20 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>
			<div class="absolute -left-20 -bottom-20 w-80 h-80 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none"></div>

			<div class="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
				<div class="max-w-3xl">
					<div class="flex items-center gap-3 mb-3">
						<AegisBadge variant={isContractPaused ? 'rose' : (isElectionActive ? 'emerald' : 'amber')} pulse={isElectionActive && !isContractPaused}>
							{isContractPaused ? 'Protocol Paused' : (isElectionActive ? 'Live Voting Active' : 'Voting Window Inactive')}
						</AegisBadge>
						<span class="text-xs font-mono text-slate-400">RBAC Multi-Level Engine</span>
					</div>

					<h1 class="text-3xl md:text-4xl font-black text-white tracking-tight">
						{election.title}
					</h1>
					<p class="text-sm md:text-base text-slate-400 mt-2 leading-relaxed">
						{election.description}
					</p>
				</div>

				<div class="flex flex-col sm:flex-row md:flex-col gap-3 min-w-[260px]">
					<TimeCountdown startTime={election.startTime} endTime={election.endTime} />
				</div>
			</div>

			<!-- Dynamic Quorum Meter Bar -->
			<div class="mt-8 pt-6 border-t border-slate-800/80">
				<QuorumGauge
					quorumReached={quorumData.quorumReached}
					turnoutBps={quorumData.turnoutBps}
					requiredQuorumBps={quorumData.requiredQuorumBps}
					votesCast={quorumData.votesCast}
					requiredVotes={quorumData.requiredVotes}
					totalVoters={election.totalVotersCount}
				/>
			</div>
		</section>

		<!-- Notifications & Transaction Feedback -->
		{#if txStatus}
			<div
				class="p-4 rounded-xl border flex items-center justify-between text-sm font-medium
				{txStatus.type === 'success' ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300' : ''}
				{txStatus.type === 'error' ? 'bg-rose-950/40 border-rose-500/40 text-rose-300' : ''}
				{txStatus.type === 'info' ? 'bg-cyan-950/40 border-cyan-500/40 text-cyan-300' : ''}"
			>
				<div class="flex items-center gap-3">
					{#if txStatus.type === 'success'}
						<svg class="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" /></svg>
					{:else if txStatus.type === 'error'}
						<svg class="w-5 h-5 text-rose-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
					{:else}
						<svg class="w-5 h-5 text-cyan-400 animate-spin" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path></svg>
					{/if}
					<span>{txStatus.text}</span>
				</div>
				<button class="text-xs opacity-75 hover:opacity-100" onclick={() => txStatus = null}>Dismiss</button>
			</div>
		{/if}

		<!-- Officer Commission Control Deck (Shown only for Admin or Officer) -->
		{#if $isOfficer || $isAdmin}
			<OfficerPanel onRefresh={loadBlockchainData} />
		{/if}

		<!-- Tabs Switcher -->
		<div class="flex items-center justify-between border-b border-slate-800 pb-2">
			<div class="flex items-center gap-2">
				<button
					class="px-4 py-2 rounded-lg text-sm font-semibold transition-all {activeTab === 'ballot' ? 'bg-slate-800 text-white shadow' : 'text-slate-400 hover:text-white'}"
					onclick={() => activeTab = 'ballot'}
				>
					Ballot Box ({candidates.length})
				</button>
				<button
					class="px-4 py-2 rounded-lg text-sm font-semibold transition-all {activeTab === 'results' ? 'bg-slate-800 text-white shadow' : 'text-slate-400 hover:text-white'}"
					onclick={() => activeTab = 'results'}
				>
					Live Tabulation ({totalVotes} Votes)
				</button>
				<button
					class="px-4 py-2 rounded-lg text-sm font-semibold transition-all {activeTab === 'governance' ? 'bg-slate-800 text-white shadow' : 'text-slate-400 hover:text-white'}"
					onclick={() => activeTab = 'governance'}
				>
					Protocol Architecture
				</button>
			</div>

			<AegisButton variant="ghost" size="sm" onclick={loadBlockchainData}>
				↻ Sync Node
			</AegisButton>
		</div>

		<!-- Tab 1: Ballot Box -->
		{#if activeTab === 'ballot'}
			<div class="grid lg:grid-cols-3 gap-6">
				<!-- Candidate Selection Column (2 cols) -->
				<div class="lg:col-span-2 flex flex-col gap-4">
					{#if candidates.length === 0}
						<AegisCard>
							<div class="py-12 text-center text-slate-400">
								<p class="font-medium text-base">No candidates registered for this ballot yet.</p>
								<p class="text-xs text-slate-500 mt-1">Election officers can register candidate platforms via the Control Deck.</p>
							</div>
						</AegisCard>
					{:else}
						{#each candidates as c}
							<label
								class="
									relative rounded-2xl p-5 border transition-all duration-200 cursor-pointer block
									{selectedCandidateId === c.id ? 'bg-slate-800/90 border-emerald-500 shadow-aegis-glow' : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 hover:bg-slate-900'}
								"
							>
								<div class="flex items-start justify-between gap-4">
									<div class="flex items-start gap-4">
										<input
											type="radio"
											name="candidate"
											value={c.id}
											bind:group={selectedCandidateId}
											disabled={!$walletAddress || $userHasVoted || !isElectionActive || isContractPaused}
											class="mt-1 h-5 w-5 accent-emerald-500"
										/>
										<div>
											<div class="flex items-center gap-2">
												<span class="font-mono text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-400 font-bold">#{c.id}</span>
												<h3 class="text-lg font-bold text-white">{c.name}</h3>
											</div>
											<p class="text-xs text-slate-400 mt-1 leading-relaxed">{c.manifesto || 'No manifesto text submitted.'}</p>
										</div>
									</div>

									<div class="text-right shrink-0">
										<span class="text-lg font-mono font-black text-emerald-400">{c.voteCount}</span>
										<span class="text-xs text-slate-500 block">votes</span>
									</div>
								</div>
							</label>
						{/each}
					{/if}
				</div>

				<!-- Ballot Confirmation Column -->
				<div class="flex flex-col gap-4">
					<AegisCard title="Cryptographic Ballot" subtitle="Cast your verified vote to the smart contract">
						{#if !$walletAddress}
							<div class="p-4 rounded-xl bg-slate-950/80 border border-slate-800 text-center">
								<p class="text-sm font-semibold text-slate-300">Wallet Not Connected</p>
								<p class="text-xs text-slate-500 mt-1 mb-4">Connect MetaMask to verify your on-chain voter role.</p>
								<AegisButton variant="cyan" size="sm" class="w-full" onclick={connectWallet}>
									Connect Wallet
								</AegisButton>
							</div>
						{:else if $userHasVoted}
							<div class="p-4 rounded-xl bg-emerald-950/30 border border-emerald-600/40 text-center">
								<div class="w-10 h-10 rounded-full bg-emerald-500/20 text-emerald-400 mx-auto flex items-center justify-center mb-2">
									✓
								</div>
								<p class="text-sm font-bold text-emerald-300">Ballot Already Cast</p>
								<p class="text-xs text-slate-400 mt-1">Your cryptographic signature is irreversibly stamped on block history.</p>
							</div>
						{:else if !isElectionActive}
							<div class="p-4 rounded-xl bg-amber-950/30 border border-amber-600/40 text-center">
								<p class="text-sm font-bold text-amber-300">Voting Window Inactive</p>
								<p class="text-xs text-slate-400 mt-1">Ballot submission is restricted by the smart contract time-lock.</p>
							</div>
						{:else if !$isVoter && election.totalVotersCount > 0}
							<div class="p-4 rounded-xl bg-slate-950/80 border border-slate-800 text-center">
								<p class="text-sm font-bold text-rose-300">Address Not Whitelisted</p>
								<p class="text-xs text-slate-400 mt-1">Your address lacks `VOTER_ROLE`. Request an officer to whitelist you.</p>
							</div>
						{:else}
							<div class="flex flex-col gap-4">
								<div class="p-3 rounded-lg bg-slate-950 border border-slate-800 text-xs">
									<div class="flex justify-between text-slate-400 mb-1">
										<span>Selected:</span>
										<strong class="text-white">
											{selectedCandidateId ? (candidates.find(c => c.id === selectedCandidateId)?.name || 'None') : 'No candidate selected'}
										</strong>
									</div>
									<div class="flex justify-between text-slate-400">
										<span>Voter Address:</span>
										<strong class="font-mono text-slate-300">{formatAddress($walletAddress)}</strong>
									</div>
								</div>

								<AegisButton
									variant="primary"
									size="lg"
									class="w-full"
									disabled={selectedCandidateId === null}
									loading={isVoting}
									onclick={castVote}
								>
									Confirm & Sign Vote
								</AegisButton>
							</div>
						{/if}
					</AegisCard>

					<!-- Protocol Summary Card -->
					<div class="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 text-xs text-slate-400 flex flex-col gap-2">
						<span class="font-semibold text-slate-200 uppercase tracking-wider text-[10px]">Smart Contract Security</span>
						<p>Zero-reentrancy architecture safeguarded by OpenZeppelin AccessControl. Automatic time-locks reject transactions outside the cryptographic timeframe.</p>
					</div>
				</div>
			</div>
		{/if}

		<!-- Tab 2: Live Results & Tabulation -->
		{#if activeTab === 'results'}
			<div class="grid md:grid-cols-3 gap-6">
				<!-- Tabulation Table -->
				<div class="md:col-span-2">
					<AegisCard title="Cryptographic Tabulation" subtitle="Real-time tally verified directly from contract storage">
						{#if candidates.length === 0}
							<p class="text-sm text-slate-400">No candidate votes to display.</p>
						{:else}
							<div class="space-y-4">
								{#each [...candidates].sort((a,b) => b.voteCount - a.voteCount) as c, idx}
									{@const pct = totalVotes > 0 ? ((c.voteCount / totalVotes) * 100).toFixed(1) : '0.0'}
									<div class="p-4 rounded-xl bg-slate-950/60 border border-slate-800 flex flex-col gap-2">
										<div class="flex items-center justify-between">
											<div class="flex items-center gap-2">
												<span class="font-mono text-xs font-bold text-slate-400">#{idx + 1}</span>
												<span class="text-base font-bold text-white">{c.name}</span>
											</div>
											<div class="flex items-center gap-3">
												<span class="text-sm font-mono font-bold text-emerald-400">{c.voteCount} votes</span>
												<span class="text-xs font-mono text-slate-500">({pct}%)</span>
											</div>
										</div>

										<!-- Bar -->
										<div class="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
											<div class="h-full bg-gradient-to-r from-emerald-500 to-cyan-500 rounded-full" style="width: {pct}%;"></div>
										</div>
									</div>
								{/each}
							</div>
						{/if}
					</AegisCard>
				</div>

				<!-- Leading / Victor Card -->
				<div>
					<AegisCard title="Current Front-Runner" subtitle="Preliminary leading delegate">
						{#if leading.winnerId > 0}
							<div class="p-5 rounded-2xl bg-gradient-to-br from-emerald-950/40 via-slate-900 to-slate-950 border border-emerald-500/40 text-center">
								<div class="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 text-xl font-black mx-auto flex items-center justify-center mb-3 shadow-aegis-glow">
									🏆
								</div>
								<h3 class="text-xl font-black text-white">{leading.winnerName}</h3>
								<p class="text-xs text-slate-400 mt-1 font-mono">{leading.winnerVoteCount} Confirmed Votes</p>

								<div class="mt-4 pt-4 border-t border-slate-800/80 flex items-center justify-center gap-2">
									{#if leading.quorumMet}
										<AegisBadge variant="emerald" size="sm">Quorum Confirmed</AegisBadge>
									{:else}
										<AegisBadge variant="amber" size="sm">Quorum Pending</AegisBadge>
									{/if}
									{#if leading.isTie}
										<AegisBadge variant="rose" size="sm">Tie Detected</AegisBadge>
									{/if}
								</div>
							</div>
						{:else}
							<p class="text-xs text-slate-500 text-center py-8">No votes submitted yet.</p>
						{/if}
					</AegisCard>
				</div>
			</div>
		{/if}

		<!-- Tab 3: Governance Architecture -->
		{#if activeTab === 'governance'}
			<div class="grid md:grid-cols-2 gap-6">
				<AegisCard title="Smart Contract Architecture" subtitle="Formal parameters & role breakdown">
					<div class="space-y-4 text-xs font-mono">
						<div class="p-3 rounded-lg bg-slate-950 border border-slate-800">
							<span class="text-slate-400 block mb-1">Contract Address:</span>
							<span class="text-emerald-400 font-bold select-all break-all">{CONTRACT_ADDRESS}</span>
						</div>

						<div class="p-3 rounded-lg bg-slate-950 border border-slate-800">
							<span class="text-slate-400 block mb-1">RBAC Roles Hierarchy:</span>
							<ul class="list-disc list-inside space-y-1 text-slate-300">
								<li><strong class="text-violet-400">DEFAULT_ADMIN_ROLE:</strong> Protocol pause, parameter tuning</li>
								<li><strong class="text-cyan-400">OFFICER_ROLE:</strong> Candidate registration, whitelist administration</li>
								<li><strong class="text-emerald-400">VOTER_ROLE:</strong> Ballot casting eligibility</li>
							</ul>
						</div>

						<div class="p-3 rounded-lg bg-slate-950 border border-slate-800">
							<span class="text-slate-400 block mb-1">Time-Lock Automation:</span>
							<p class="text-slate-300 font-sans">
								Execution is gated strictly by <code>block.timestamp</code>. Once <code>startTime</code> arrives, candidate creation freezes. When <code>endTime</code> strikes, ballots close deterministically without manual administrator intervention.
							</p>
						</div>
					</div>
				</AegisCard>

				<AegisCard title="Cryptographic Merkle Proofs" subtitle="Scale to millions of voters with gas-free whitelisting">
					<div class="space-y-4 text-xs">
						<div class="p-3 rounded-lg bg-slate-950 border border-slate-800 font-mono">
							<span class="text-slate-400 block mb-1">Active Merkle Root:</span>
							<span class="text-cyan-400 break-all">{election.merkleRoot}</span>
						</div>

						<p class="text-slate-300 leading-relaxed font-sans">
							AegisVote incorporates dual-mode voter verification. Organizations can either whitelist addresses directly on-chain using <code>VOTER_ROLE</code> or publish an off-chain Merkle Root, allowing voters to verify eligibility via cryptographic proof without storing large datasets in EVM state.
						</p>

						<div class="p-3 rounded-lg bg-emerald-950/20 border border-emerald-500/30 text-emerald-300 font-sans">
							✓ 100% compliant with OpenZeppelin 5.0 security contracts and Hardhat TypeScript testing standards.
						</div>
					</div>
				</AegisCard>
			</div>
		{/if}
	</main>

	<!-- Footer -->
	<footer class="border-t border-slate-800/80 bg-slate-950/70 py-6 mt-16 text-center text-xs text-slate-500 font-mono">
		<p>AegisVote Protocol • Distributed Systems & Smart Contract Security Showcase</p>
		<p class="mt-1 text-slate-600">Engineered with Solidity 0.8.24 • OpenZeppelin • Hardhat • SvelteKit • Ethers.js v6</p>
	</footer>
</div>
