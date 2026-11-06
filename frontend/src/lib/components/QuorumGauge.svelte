<script lang="ts">
	import AegisBadge from './AegisBadge.svelte';

	let {
		quorumReached = false,
		turnoutBps = 0,
		requiredQuorumBps = 5000,
		votesCast = 0,
		requiredVotes = 0,
		totalVoters = 0
	}: {
		quorumReached: boolean;
		turnoutBps: number;
		requiredQuorumBps: number;
		votesCast: number;
		requiredVotes: number;
		totalVoters: number;
	} = $props();

	let turnoutPercent = $derived((turnoutBps / 100).toFixed(1));
	let targetPercent = $derived((requiredQuorumBps / 100).toFixed(1));
	let progressWidth = $derived(Math.min(100, Math.max(0, turnoutBps / 100)));
</script>

<div class="flex flex-col gap-3 p-4 rounded-xl bg-slate-950/60 border border-slate-800">
	<div class="flex items-center justify-between">
		<div class="flex items-center gap-2">
			<span class="text-xs font-semibold uppercase tracking-wider text-slate-400">Quorum Status</span>
			{#if quorumReached}
				<AegisBadge variant="emerald" size="sm">Valid Quorum Met</AegisBadge>
			{:else}
				<AegisBadge variant="amber" size="sm">Awaiting Quorum</AegisBadge>
			{/if}
		</div>
		<span class="font-mono text-sm font-bold text-white">{votesCast} / {requiredVotes} votes</span>
	</div>

	<!-- Progress Bar -->
	<div class="relative w-full h-3 bg-slate-800 rounded-full overflow-hidden">
		<!-- Quorum marker line -->
		<div
			class="absolute top-0 bottom-0 w-0.5 bg-white/60 z-10"
			style="left: {targetPercent}%;"
			title="Quorum Threshold ({targetPercent}%)"
		></div>

		<!-- Filled bar -->
		<div
			class="h-full transition-all duration-500 rounded-full {quorumReached ? 'bg-gradient-to-r from-emerald-500 to-teal-400 shadow-aegis-glow' : 'bg-gradient-to-r from-cyan-600 to-emerald-600'}"
			style="width: {progressWidth}%;"
		></div>
	</div>

	<div class="flex items-center justify-between text-xs text-slate-400 font-mono">
		<span>Turnout: <strong class="text-slate-200">{turnoutPercent}%</strong> (Target: {targetPercent}%)</span>
		<span>Electorate: <strong class="text-slate-200">{totalVoters}</strong></span>
	</div>
</div>
