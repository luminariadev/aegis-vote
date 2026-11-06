<script lang="ts">
	import AegisCard from './AegisCard.svelte';
	import AegisButton from './AegisButton.svelte';
	import AegisBadge from './AegisBadge.svelte';
	import { signer, isAdmin } from '../stores/walletStore';
	import { CONTRACT_ADDRESS, CONTRACT_ABI } from '../config';
	import { Contract } from 'ethers';

	let {
		onRefresh
	}: {
		onRefresh: () => Promise<void>;
	} = $props();

	let candidateName = $state('');
	let candidateManifesto = $state('');
	let voterAddress = $state('');
	let statusMessage = $state<string | null>(null);
	let isSubmitting = $state(false);

	async function registerCandidate() {
		if (!$signer || !candidateName.trim()) return;
		isSubmitting = true;
		statusMessage = 'Submitting candidate registration transaction...';
		try {
			const contract = new Contract(CONTRACT_ADDRESS, CONTRACT_ABI, $signer);
			const tx = await contract.registerCandidate(candidateName.trim(), candidateManifesto.trim());
			await tx.wait();
			statusMessage = `Candidate "${candidateName}" registered successfully!`;
			candidateName = '';
			candidateManifesto = '';
			await onRefresh();
		} catch (e: any) {
			console.error(e);
			statusMessage = 'Registration failed: ' + (e.reason || e.message);
		} finally {
			isSubmitting = false;
		}
	}

	async function whitelistVoter() {
		if (!$signer || !voterAddress.trim()) return;
		isSubmitting = true;
		statusMessage = 'Whitelisting voter address on-chain...';
		try {
			const contract = new Contract(CONTRACT_ADDRESS, CONTRACT_ABI, $signer);
			const tx = await contract.whitelistVoter(voterAddress.trim());
			await tx.wait();
			statusMessage = `Voter ${voterAddress} granted VOTER_ROLE!`;
			voterAddress = '';
			await onRefresh();
		} catch (e: any) {
			console.error(e);
			statusMessage = 'Whitelisting failed: ' + (e.reason || e.message);
		} finally {
			isSubmitting = false;
		}
	}

	async function togglePause(shouldPause: boolean) {
		if (!$signer) return;
		isSubmitting = true;
		statusMessage = shouldPause ? 'Pausing contract circuit-breaker...' : 'Resuming contract execution...';
		try {
			const contract = new Contract(CONTRACT_ADDRESS, CONTRACT_ABI, $signer);
			const tx = shouldPause ? await contract.pause() : await contract.unpause();
			await tx.wait();
			statusMessage = shouldPause ? 'Contract paused!' : 'Contract unpaused!';
			await onRefresh();
		} catch (e: any) {
			console.error(e);
			statusMessage = 'Action failed: ' + (e.reason || e.message);
		} finally {
			isSubmitting = false;
		}
	}
</script>

<AegisCard
	title="Election Commission Control Deck"
	subtitle="Restricted to accounts with OFFICER_ROLE & DEFAULT_ADMIN_ROLE"
	class="border-violet-500/30 bg-slate-900/90"
>
	{#snippet badge()}
		<AegisBadge variant="violet">Authorized Officer</AegisBadge>
	{/snippet}

	{#if statusMessage}
		<div class="mb-4 p-3 rounded-lg bg-slate-950 border border-slate-700 text-xs font-mono text-cyan-300 flex items-center justify-between">
			<span>{statusMessage}</span>
			<button class="text-slate-400 hover:text-white" onclick={() => statusMessage = null}>✕</button>
		</div>
	{/if}

	<div class="grid md:grid-cols-2 gap-6">
		<!-- Candidate Registration Form -->
		<div class="p-4 rounded-xl bg-slate-950/60 border border-slate-800 flex flex-col gap-3">
			<h3 class="text-sm font-bold text-white flex items-center gap-2">
				<span class="w-2 h-2 rounded-full bg-emerald-400"></span>
				Register Candidate
			</h3>
			<p class="text-xs text-slate-400">Available prior to election startTime window.</p>

			<input
				type="text"
				placeholder="Candidate Full Name"
				bind:value={candidateName}
				class="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
			/>

			<textarea
				placeholder="Platform Manifesto / Bio"
				rows="2"
				bind:value={candidateManifesto}
				class="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
			></textarea>

			<AegisButton
				variant="primary"
				size="sm"
				loading={isSubmitting}
				disabled={!candidateName.trim()}
				onclick={registerCandidate}
			>
				Add to Ballot
			</AegisButton>
		</div>

		<!-- Whitelist Voter Form -->
		<div class="p-4 rounded-xl bg-slate-950/60 border border-slate-800 flex flex-col gap-3">
			<h3 class="text-sm font-bold text-white flex items-center gap-2">
				<span class="w-2 h-2 rounded-full bg-cyan-400"></span>
				Whitelist Voter (RBAC)
			</h3>
			<p class="text-xs text-slate-400">Grant VOTER_ROLE permissions to an Ethereum address.</p>

			<input
				type="text"
				placeholder="0x..."
				bind:value={voterAddress}
				class="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white font-mono placeholder-slate-500 focus:outline-none focus:border-cyan-500"
			/>

			<AegisButton
				variant="cyan"
				size="sm"
				loading={isSubmitting}
				disabled={!voterAddress.trim() || !voterAddress.startsWith('0x')}
				onclick={whitelistVoter}
			>
				Grant Voter Role
			</AegisButton>

			{#if $isAdmin}
				<div class="mt-2 pt-3 border-t border-slate-800 flex items-center justify-between">
					<span class="text-xs text-slate-400">Circuit Breaker:</span>
					<div class="flex gap-2">
						<AegisButton variant="danger" size="sm" onclick={() => togglePause(true)} disabled={isSubmitting}>
							Pause
						</AegisButton>
						<AegisButton variant="secondary" size="sm" onclick={() => togglePause(false)} disabled={isSubmitting}>
							Unpause
						</AegisButton>
					</div>
				</div>
			{/if}
		</div>
	</div>
</AegisCard>
