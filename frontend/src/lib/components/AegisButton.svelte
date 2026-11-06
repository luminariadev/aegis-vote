<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		children,
		onclick,
		variant = 'primary',
		size = 'md',
		type = 'button',
		disabled = false,
		loading = false,
		class: className = ''
	}: {
		children: Snippet;
		onclick?: (e: MouseEvent) => void;
		variant?: 'primary' | 'secondary' | 'cyan' | 'danger' | 'outline' | 'ghost';
		size?: 'sm' | 'md' | 'lg';
		type?: 'button' | 'submit' | 'reset';
		disabled?: boolean;
		loading?: boolean;
		class?: string;
	} = $props();

	const variantStyles = {
		primary: 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-aegis-glow border border-emerald-400/30 active:scale-[0.98]',
		cyan: 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-aegis-cyan-glow border border-cyan-400/30 active:scale-[0.98]',
		secondary: 'bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700 active:scale-[0.98]',
		danger: 'bg-rose-600/90 hover:bg-rose-600 text-white border border-rose-500/40 active:scale-[0.98]',
		outline: 'bg-transparent hover:bg-slate-800/80 text-slate-200 border border-slate-700 active:scale-[0.98]',
		ghost: 'bg-transparent hover:bg-slate-800/50 text-slate-300 border-none'
	};

	const sizeStyles = {
		sm: 'px-3 py-1.5 text-xs font-semibold rounded-md gap-1.5',
		md: 'px-4 py-2 text-sm font-semibold rounded-lg gap-2',
		lg: 'px-6 py-3 text-base font-bold rounded-xl gap-2.5'
	};
</script>

<button
	{type}
	class="
		inline-flex items-center justify-center font-sans tracking-wide
		transition-all duration-150 ease-out select-none
		disabled:opacity-50 disabled:pointer-events-none disabled:shadow-none
		{variantStyles[variant]}
		{sizeStyles[size]}
		{className}
	"
	{onclick}
	disabled={disabled || loading}
>
	{#if loading}
		<svg class="animate-spin h-4 w-4 text-current" fill="none" viewBox="0 0 24 24">
			<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
			<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
		</svg>
	{/if}
	{@render children()}
</button>
