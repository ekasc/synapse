<section
	class="section section--problem relative mx-auto max-w-[84rem] px-[clamp(1.5rem,4vw,4rem)] pt-[clamp(4rem,7vw,6rem)] pb-[clamp(3.5rem,7vw,6rem)]"
	aria-labelledby="problem-heading"
>
	<div
		class="problem-top mx-auto mb-12 grid max-w-[78rem] grid-cols-[minmax(0,42rem)_minmax(18rem,28rem)] items-end gap-[clamp(2rem,5vw,5rem)] max-md:grid-cols-1 max-md:items-start max-md:gap-8"
	>
		<header class="problem-head flex h-full max-w-[44rem] flex-col gap-5">
			<span class="stamp" style="transform: rotate(-0.6deg);">the mess</span>
			<h2
				id="problem-heading"
				class="problem-title font-hand m-0 text-[clamp(2rem,3.4vw,2.8rem)] leading-[1.1] text-[var(--ink)]"
			>
				your data lives here. and here. and here.
			</h2>

			<div class="problem-body flex max-w-md shrink-0 flex-col gap-4 max-md:max-w-none">
				<p class="m-0 text-[clamp(1.2rem,1.5vw,1.4rem)] leading-[1.6] text-[var(--ink)]">
					Each week looks like this on paper. Fragments in five different places, none of them
					talking to each other.
				</p>
				<p class="m-0 text-[clamp(1.2rem,1.5vw,1.4rem)] leading-[1.6] text-[var(--ink)]">
					The data exists. The connection doesn't.
				</p>
			</div>
		</header>
		<figure
			class="messy-page-wrap relative mx-auto w-[min(100%,40rem)]"
			aria-label="A torn notebook page showing the chaos of a typical week"
		>
			<div
				class="messy-page relative min-h-[36rem] border border-[var(--border-faint)] bg-[var(--surface-paper)] px-8 pt-7 pb-9 shadow-[inset_0_1px_0_var(--surface-paper),0_6px_14px_var(--shadow-ink)] max-sm:px-[18px] max-sm:pt-5 max-sm:pb-7"
				style="transform: rotate(1.4deg);"
			>
				<div
					class="coffee-ring absolute top-6 left-[60px] h-[46px] w-[46px] rounded-full border-2 border-[rgba(115,70,30,0.16)] opacity-50"
					aria-hidden="true"
				></div>
				<div class="messy-grid grid grid-cols-1 gap-[22px]">
					<div class="cal-block flex flex-col gap-2.5">
						<span
							class="cal-head font-hand text-[1.15rem] font-[var(--font-body)] font-normal text-[var(--ink)]"
							>week 03</span
						>
						<div
							class="cal-grid grid grid-cols-7 gap-[5px] text-[var(--ink-soft)] text-[var(--text-caption)]"
						>
							<span class="d py-0.5 text-center font-semibold">S</span><span
								class="d py-0.5 text-center font-semibold">M</span
							><span class="d py-0.5 text-center font-semibold">T</span><span
								class="d py-0.5 text-center font-semibold">W</span
							><span class="d py-0.5 text-center font-semibold">T</span><span
								class="d py-0.5 text-center font-semibold">F</span
							><span class="d py-0.5 text-center font-semibold">S</span>
							{#each ['', '', 'cross', '', 'red', '', '', '', '', '', 'cross', 'red', '', '', '', '', 'cross', '', '', '', ''] as state}
								<span
									class="cell aspect-square rounded-[1px] border border-[var(--border-faint)]"
									class:bg-[rgba(26,26,23,0.18)]={state === 'cross'}
									class:bg-[var(--pen-red)]={state === 'red'}
								></span>
							{/each}
						</div>
					</div>
					<div
						class="cal-legend mt-1 flex gap-[18px] text-[var(--ink-soft)] text-[var(--text-caption)]"
						aria-hidden="true"
					>
						<span
							><i class="dot red mr-1.5 inline-block h-2.5 w-2.5 bg-[var(--pen-red)] align-middle"
							></i> deadline</span
						>
						<span
							><i
								class="dot cross mr-1.5 inline-block h-2.5 w-2.5 bg-[rgba(26,26,23,0.4)] align-middle"
							></i> class</span
						>
					</div>
					<div
						class="scribble scribble-1 absolute top-[250px] right-6 rotate-[-4deg] text-[1.3rem] font-[var(--font-body)] text-[var(--ink)] opacity-40"
						aria-hidden="true"
					>
						math 1120
					</div>
					<div
						class="scribble scribble-2 absolute top-[300px] left-8 rotate-2 text-[1.3rem] font-[var(--font-body)] text-[var(--ink)] opacity-40"
						aria-hidden="true"
					>
						mar 24
					</div>
					<div
						class="absolute sticky top-[50px] right-8 max-w-32 bg-[var(--highlight-soft)] px-3.5 py-3 text-[1.1rem] leading-[1.2] font-[var(--font-body)] text-[var(--ink)] shadow-[inset_0_1px_0_var(--surface-paper),0_2px_6px_var(--shadow-ink)]"
						style="transform: rotate(-3.4deg);"
						aria-label="A sticky note with a handwritten question"
					>
						<p>what's the<br />prereq for<br />CSIS 4495?</p>
					</div>
					<div
						class="todo mt-8 flex flex-col gap-2 pl-1 text-[var(--text-small)]"
						aria-label="A to-do list with three items crossed off and one circled in red"
					>
						<span
							class="todo-label font-hand mb-2 block text-[1.15rem] font-[var(--font-body)] text-[var(--ink)]"
							>to-do</span
						>
						<span
							class="done flex items-center gap-2 text-[var(--ink-soft)] line-through opacity-55"
							>☐ read ch.4</span
						>
						<span
							class="done flex items-center gap-2 text-[var(--ink-soft)] line-through opacity-55"
							>☐ lab report</span
						>
						<span
							class="done flex items-center gap-2 text-[var(--ink-soft)] line-through opacity-55"
							>☐ email prof</span
						>
						<span
							class="red-circle inline-flex w-fit items-center gap-1.5 rounded-full border-[1.5px] border-[var(--pen-red)] py-[3px] pr-3.5 pl-2.5 font-medium text-[var(--pen-red)]"
							>◯ study for midterm</span
						>
					</div>
				</div>
			</div>

			<svg
				class="margin-annotation margin-annotation--problem absolute top-[5.4rem] left-[7.25rem] h-9 w-[110px] max-sm:hidden"
				viewBox="0 0 110 36"
				aria-hidden="true"
			>
				<g class="hand-arrow">
					<path d="M 2 18 C 30 14 70 14 100 18" />
					<path d="M 92 11 L 104 18 L 92 25" fill="none" />
				</g>
			</svg>
			<span
				class="margin-note margin-note--problem absolute top-[4.5rem] left-4 max-w-28 rotate-[-6deg] text-[1.4rem] leading-[1.15] text-[var(--pen-red)] max-sm:static max-sm:mt-4 max-sm:max-w-none max-sm:rotate-[-3deg] max-sm:text-[1.2rem]"
				aria-hidden="true">this. every week.</span
			>
		</figure>
	</div>
</section>
