<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		children,
		title,
		subtitle,
		badge,
		action,
		glow = false,
		class: className = ''
	}: {
		children: Snippet;
		title?: string;
		subtitle?: string;
		badge?: Snippet;
		action?: Snippet;
		glow?: boolean;
		class?: string;
	} = $props();
</script>

<div
	class="
		relative rounded-2xl bg-slate-900/80 backdrop-blur-md
		border border-slate-800/80 p-6 transition-all duration-200
		hover:border-slate-700/90 shadow-aegis-card
		{glow ? 'shadow-aegis-glow border-emerald-500/30' : ''}
		{className}
	"
>
	{#if title || subtitle || badge || action}
		<div class="flex items-start justify-between gap-4 mb-6 pb-4 border-b border-slate-800/80">
			<div>
				{#if title}
					<h2 class="text-xl font-bold tracking-tight text-white flex items-center gap-2">
						{title}
					</h2>
				{/if}
				{#if subtitle}
					<p class="text-xs text-slate-400 mt-1">{subtitle}</p>
				{/if}
			</div>

			<div class="flex items-center gap-2">
				{#if badge}
					{@render badge()}
				{/if}
				{#if action}
					{@render action()}
				{/if}
			</div>
		</div>
	{/if}

	<div class="text-slate-200">
		{@render children()}
	</div>
</div>
