<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		children,
		variant = 'neutral',
		size = 'md',
		pulse = false
	}: {
		children: Snippet;
		variant?: 'emerald' | 'cyan' | 'violet' | 'amber' | 'rose' | 'neutral';
		size?: 'sm' | 'md';
		pulse?: boolean;
	} = $props();

	const variantStyles = {
		emerald: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
		cyan: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30',
		violet: 'bg-violet-500/10 text-violet-400 border-violet-500/30',
		amber: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
		rose: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
		neutral: 'bg-slate-800 text-slate-300 border-slate-700'
	};

	const dotStyles = {
		emerald: 'bg-emerald-400',
		cyan: 'bg-cyan-400',
		violet: 'bg-violet-400',
		amber: 'bg-amber-400',
		rose: 'bg-rose-400',
		neutral: 'bg-slate-400'
	};

	const sizeStyles = {
		sm: 'px-2 py-0.5 text-xs font-medium',
		md: 'px-2.5 py-1 text-xs font-semibold'
	};
</script>

<span
	class="
		inline-flex items-center gap-1.5 rounded-full border
		{variantStyles[variant]}
		{sizeStyles[size]}
	"
>
	{#if pulse}
		<span class="relative flex h-2 w-2">
			<span class="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 {dotStyles[variant]}"></span>
			<span class="relative inline-flex rounded-full h-2 w-2 {dotStyles[variant]}"></span>
		</span>
	{/if}
	{@render children()}
</span>
