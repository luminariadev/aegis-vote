<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import AegisBadge from './AegisBadge.svelte';

	let {
		startTime = 0,
		endTime = 0
	}: {
		startTime: number;
		endTime: number;
	} = $props();

	let now = $state(Math.floor(Date.now() / 1000));
	let timer: any = null;

	onMount(() => {
		timer = setInterval(() => {
			now = Math.floor(Date.now() / 1000);
		}, 1000);
	});

	onDestroy(() => {
		if (timer) clearInterval(timer);
	});

	let status = $derived.by(() => {
		if (!startTime || !endTime) return 'unknown';
		if (now < startTime) return 'pending';
		if (now <= endTime) return 'active';
		return 'ended';
	});

	let remainingSeconds = $derived.by(() => {
		if (status === 'pending') return Math.max(0, startTime - now);
		if (status === 'active') return Math.max(0, endTime - now);
		return 0;
	});

	function formatTime(totalSec: number) {
		const days = Math.floor(totalSec / 86400);
		const hours = Math.floor((totalSec % 86400) / 3600);
		const minutes = Math.floor((totalSec % 3600) / 60);
		const seconds = totalSec % 60;

		const parts = [];
		if (days > 0) parts.push(`${days}d`);
		parts.push(`${hours.toString().padStart(2, '0')}h`);
		parts.push(`${minutes.toString().padStart(2, '0')}m`);
		parts.push(`${seconds.toString().padStart(2, '0')}s`);
		return parts.join(' : ');
	}
</script>

<div class="flex flex-col gap-2 p-4 rounded-xl bg-slate-950/60 border border-slate-800">
	<div class="flex items-center justify-between">
		<span class="text-xs font-semibold uppercase tracking-wider text-slate-400">Time-Lock Engine</span>
		{#if status === 'active'}
			<AegisBadge variant="emerald" pulse={true}>Voting Active</AegisBadge>
		{:else if status === 'pending'}
			<AegisBadge variant="amber" pulse={true}>Scheduled</AegisBadge>
		{:else if status === 'ended'}
			<AegisBadge variant="neutral">Finalized</AegisBadge>
		{:else}
			<AegisBadge variant="neutral">Awaiting Sync</AegisBadge>
		{/if}
	</div>

	<div class="flex items-baseline justify-between pt-1">
		<div class="text-xs text-slate-400">
			{#if status === 'pending'}
				Opens in:
			{:else if status === 'active'}
				Time Remaining:
			{:else}
				Window Closed:
			{/if}
		</div>
		<div class="font-mono text-xl font-bold tracking-tight text-white">
			{#if status === 'ended'}
				00h : 00m : 00s
			{:else}
				{formatTime(remainingSeconds)}
			{/if}
		</div>
	</div>

	<div class="text-[11px] text-slate-500 font-mono flex justify-between pt-1 border-t border-slate-800/60">
		<span>Start: {startTime ? new Date(startTime * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}</span>
		<span>End: {endTime ? new Date(endTime * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}</span>
	</div>
</div>
