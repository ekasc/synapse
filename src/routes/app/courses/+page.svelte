<script lang="ts">
	let { data } = $props();
	let { semesters, courses: initialCourses, graph } = $derived(data);

	type Course = { id: string; semesterId: string; code: string; name: string; instructor?: string; credits?: number; tag?: string };
	type Edge = { id: string; source: string; target: string; label: string; type: 'prereq' | 'related' | 'concept'; directed: boolean };
	type Point = { x: number; y: number };
	type Snapshot = { positions: Record<string, Point>; edges: Edge[] };
	type SelectionBox = { start: Point; end: Point } | null;

	// This is intentionally local editor state. Server data seeds it once; the user owns the graph after that.
	// svelte-ignore state_referenced_locally
	let courses = $state<Course[]>(initialCourses);
	// svelte-ignore state_referenced_locally
	let edges = $state<Edge[]>((graph.edges as Partial<Edge>[]).map(normalizeEdge));
	// svelte-ignore state_referenced_locally
	let positions = $state<Record<string, Point>>(graph.positions as Record<string, Point>);

	let selectedIds = $state<string[]>([]);
	let selectedEdgeId = $state<string | null>(null);
	let linkSource = $state<string | null>(null);
	let tool = $state<'select' | 'link'>('select');

	let panX = $state(0);
	let panY = $state(0);
	let zoom = $state(1);
	let isPanning = $state(false);
	let panStart = $state<Point>({ x: 0, y: 0 });
	let panStartOffset = $state<Point>({ x: 0, y: 0 });

	let dragIds = $state<string[]>([]);
	let dragStartPoint = $state<Point>({ x: 0, y: 0 });
	let dragStartPositions = $state<Record<string, Point>>({});
	let selectionBox = $state<SelectionBox>(null);

	let showAddForm = $state(false);
	let addCode = $state('');
	let addName = $state('');

	let undoStack = $state<Snapshot[]>([]);
	let redoStack = $state<Snapshot[]>([]);
	let saveTimer: ReturnType<typeof setTimeout> | null = null;
	let saveState = $state<'saved' | 'saving' | 'error'>('saved');
	let showHelp = $state(false);

	const NODE_W = 176;
	const NODE_H = 70;
	const WORLD_W = 6000;
	const WORLD_H = 6000;
	const GRID = 40;
	const TAGS = ['core', 'programming', 'math', 'systems', 'ai', 'writing'] as const;
	const TAG_COLOR: Record<string, string> = {
		core: '#fbf8f0',
		programming: '#dbeafe',
		math: '#dcfce7',
		systems: '#fef3c7',
		ai: '#ede9fe',
		writing: '#fee2e2',
	};

	const selectedId = $derived(selectedIds[selectedIds.length - 1] ?? null);
	const coursesById = $derived.by(() => {
		const byId: Record<string, Course> = {};
		for (const course of courses) byId[course.id] = course;
		return byId;
	});
	const semesterById = $derived.by(() => {
		const byId: Record<string, { id: string; term: string; year: number; order: number }> = {};
		for (const semester of semesters) byId[semester.id] = semester;
		return byId;
	});
	const selectedCourse = $derived(selectedId ? coursesById[selectedId] : null);
	const selectedEdge = $derived(selectedEdgeId ? edges.find((edge) => edge.id === selectedEdgeId) : null);

	$effect(() => {
		if (Object.keys(positions).length === 0 && courses.length > 0) organize();
	});

	function normalizeEdge(edge: Partial<Edge>): Edge {
		return {
			id: edge.id ?? crypto.randomUUID(),
			source: edge.source ?? '',
			target: edge.target ?? '',
			label: edge.label ?? '',
			type: edge.type ?? 'related',
			directed: edge.directed ?? true,
		};
	}

	function snapshot(): Snapshot {
		return {
			positions: JSON.parse(JSON.stringify(positions)) as Record<string, Point>,
			edges: JSON.parse(JSON.stringify(edges)) as Edge[],
		};
	}

	function pushHistory() {
		undoStack = [...undoStack.slice(-24), snapshot()];
		redoStack = [];
	}

	function undo() {
		const previous = undoStack.at(-1);
		if (!previous) return;
		redoStack = [...redoStack, snapshot()];
		undoStack = undoStack.slice(0, -1);
		positions = previous.positions;
		edges = previous.edges;
		queueSaveGraph();
	}

	function redo() {
		const next = redoStack.at(-1);
		if (!next) return;
		undoStack = [...undoStack, snapshot()];
		redoStack = redoStack.slice(0, -1);
		positions = next.positions;
		edges = next.edges;
		queueSaveGraph();
	}

	function queueSaveGraph() {
		saveState = 'saving';
		if (saveTimer) clearTimeout(saveTimer);
		saveTimer = setTimeout(async () => {
			try {
				const response = await fetch('/api/graph', {
					method: 'PUT',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ positions, edges }),
				});
				saveState = response.ok ? 'saved' : 'error';
			} catch {
				saveState = 'error';
			}
		}, 250);
	}

	async function refreshFromServer() {
		const [courseResponse, graphResponse] = await Promise.all([
			fetch('/api/courses'),
			fetch('/api/graph'),
		]);
		if (!courseResponse.ok || !graphResponse.ok) {
			saveState = 'error';
			return;
		}
		courses = await courseResponse.json() as Course[];
		const nextGraph = await graphResponse.json() as { positions: Record<string, Point>; edges: Partial<Edge>[] };
		positions = nextGraph.positions;
		edges = nextGraph.edges.map(normalizeEdge);
		selectedIds = [];
		selectedEdgeId = null;
		saveState = 'saved';
	}

	function courseLabel(course: Course) {
		const semester = semesterById[course.semesterId];
		return semester ? `${semester.term} ${semester.year}` : 'Unplaced';
	}

	function nodeFill(course: Course) {
		return TAG_COLOR[course.tag ?? 'core'] ?? TAG_COLOR.core;
	}

	function worldPoint(e: PointerEvent | MouseEvent): Point {
		return { x: (e.clientX - panX) / zoom, y: (e.clientY - panY) / zoom };
	}

	function nodeCenter(id: string): Point | null {
		const pos = positions[id];
		if (!pos) return null;
		return { x: pos.x + NODE_W / 2, y: pos.y + NODE_H / 2 };
	}

	function organize() {
		pushHistory();
		const next: Record<string, Point> = {};
		const grouped: Record<string, Course[]> = {};
		for (const course of courses) (grouped[course.semesterId] ??= []).push(course);
		semesters.forEach((semester: { id: string }, si: number) => {
			const group = grouped[semester.id] ?? [];
			const baseX = 80 + si * 260;
			const baseY = 90;
			group.forEach((course, ci) => next[course.id] = { x: baseX, y: baseY + ci * 104 });
		});
		courses.filter((course) => !next[course.id]).forEach((course, i) => {
			next[course.id] = { x: 80 + (i % 4) * 260, y: 560 + Math.floor(i / 4) * 104 };
		});
		positions = next;
		queueSaveGraph();
	}

	function fitView() {
		const placed = Object.values(positions);
		if (placed.length === 0) return;
		const minX = Math.min(...placed.map((p) => p.x));
		const minY = Math.min(...placed.map((p) => p.y));
		panX = 80 - minX * zoom;
		panY = 80 - minY * zoom;
	}

	function setSelection(id: string, additive: boolean) {
		selectedEdgeId = null;
		if (!additive) {
			selectedIds = [id];
			return;
		}
		selectedIds = selectedIds.includes(id)
			? selectedIds.filter((selected) => selected !== id)
			: [...selectedIds, id];
	}

	function isCanvasTarget(target: EventTarget | null) {
		return target instanceof Element && !target.closest('.course-node, .edge-label, .minimap');
	}

	function onBgPointerDown(e: PointerEvent) {
		if (!isCanvasTarget(e.target)) return;
		if (tool === 'link') return;
		selectedEdgeId = null;
		if (e.shiftKey) {
			const point = worldPoint(e);
			selectionBox = { start: point, end: point };
			return;
		}
		selectedIds = [];
		isPanning = true;
		panStart = { x: e.clientX, y: e.clientY };
		panStartOffset = { x: panX, y: panY };
	}

	function onCanvasDblClick(e: MouseEvent) {
		if (!isCanvasTarget(e.target)) return;
		void createCourseAt(worldPoint(e));
	}

	function onNodePointerDown(e: PointerEvent, id: string) {
		e.stopPropagation();
		e.preventDefault();
		if (tool === 'link') {
			selectedIds = [id];
			if (!linkSource) linkSource = id;
			else if (linkSource === id) linkSource = null;
			else {
				const existing = edges.find((edge) => edge.source === linkSource && edge.target === id);
				pushHistory();
				edges = existing
					? edges.filter((edge) => edge.id !== existing.id)
					: [...edges, { id: crypto.randomUUID(), source: linkSource, target: id, label: 'related', type: 'related', directed: true }];
				linkSource = null;
				queueSaveGraph();
			}
			return;
		}

		const additive = e.shiftKey || e.metaKey || e.ctrlKey;
		setSelection(id, additive);
		const activeIds = selectedIds.includes(id) && !additive ? selectedIds : [id];
		const point = worldPoint(e);
		pushHistory();
		dragIds = activeIds;
		dragStartPoint = point;
		dragStartPositions = Object.fromEntries(activeIds.map((courseId) => [courseId, positions[courseId]]).filter(([, pos]) => Boolean(pos))) as Record<string, Point>;
	}

	function onPointerMove(e: PointerEvent) {
		if (isPanning) {
			panX = panStartOffset.x + (e.clientX - panStart.x);
			panY = panStartOffset.y + (e.clientY - panStart.y);
			return;
		}
		if (selectionBox) {
			selectionBox = { ...selectionBox, end: worldPoint(e) };
			return;
		}
		if (dragIds.length === 0) return;
		const point = worldPoint(e);
		const dx = point.x - dragStartPoint.x;
		const dy = point.y - dragStartPoint.y;
		const next = { ...positions };
		for (const id of dragIds) {
			const start = dragStartPositions[id];
			if (start) next[id] = { x: start.x + dx, y: start.y + dy };
		}
		positions = next;
	}

	function onPointerUp() {
		isPanning = false;
		if (selectionBox) {
			const left = Math.min(selectionBox.start.x, selectionBox.end.x);
			const right = Math.max(selectionBox.start.x, selectionBox.end.x);
			const top = Math.min(selectionBox.start.y, selectionBox.end.y);
			const bottom = Math.max(selectionBox.start.y, selectionBox.end.y);
			selectedIds = courses.filter((course) => {
				const pos = positions[course.id];
				if (!pos) return false;
				return pos.x >= left && pos.x + NODE_W <= right && pos.y >= top && pos.y + NODE_H <= bottom;
			}).map((course) => course.id);
			selectionBox = null;
		}
		if (dragIds.length > 0) queueSaveGraph();
		dragIds = [];
		dragStartPositions = {};
	}

	function onWheel(e: WheelEvent) {
		e.preventDefault();
		const nextZoom = Math.max(0.25, Math.min(2.5, zoom + (-e.deltaY * 0.001) * zoom));
		const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
		const mx = e.clientX - rect.left;
		const my = e.clientY - rect.top;
		const scale = nextZoom / zoom;
		panX = mx - (mx - panX) * scale;
		panY = my - (my - panY) * scale;
		zoom = nextZoom;
	}

	async function createCourseAt(point: Point, code = 'NEW', name = 'Untitled course') {
		const firstSemester = semesters[0];
		if (!firstSemester) return;
		pushHistory();
		const id = crypto.randomUUID();
		const newCourse: Course = { id, semesterId: firstSemester.id, code, name, tag: 'core' };
		await fetch('/api/courses', { method: 'POST', body: JSON.stringify(newCourse) });
		courses = [...courses, newCourse];
		positions = { ...positions, [id]: { x: point.x - NODE_W / 2, y: point.y - NODE_H / 2 } };
		selectedIds = [id];
		queueSaveGraph();
	}

	async function addNewCourse() {
		if (!addCode.trim() || !addName.trim()) return;
		await createCourseAt({ x: 120 - panX / zoom, y: 120 - panY / zoom }, addCode.trim().toUpperCase(), addName.trim());
		addCode = '';
		addName = '';
		showAddForm = false;
	}

	function updateCourseField(id: string, updates: Partial<Course>) {
		courses = courses.map((course) => course.id === id ? { ...course, ...updates } : course);
		void fetch('/api/courses', { method: 'PATCH', body: JSON.stringify({ id, ...updates }) });
	}

	function duplicateSelected() {
		if (selectedIds.length === 0) return;
		pushHistory();
		const newCourses: Course[] = [];
		const newPositions = { ...positions };
		const newIds: string[] = [];
		for (const oldId of selectedIds) {
			const source = coursesById[oldId];
			const pos = positions[oldId];
			if (!source || !pos) continue;
			const id = crypto.randomUUID();
			newCourses.push({ ...source, id, code: `${source.code}*` });
			newPositions[id] = { x: pos.x + 36, y: pos.y + 36 };
			newIds.push(id);
		}
		courses = [...courses, ...newCourses];
		positions = newPositions;
		selectedIds = newIds;
		queueSaveGraph();
	}

	function deleteSelected() {
		if (selectedEdgeId) {
			pushHistory();
			edges = edges.filter((edge) => edge.id !== selectedEdgeId);
			selectedEdgeId = null;
			queueSaveGraph();
			return;
		}
		if (selectedIds.length === 0) return;
		pushHistory();
		const doomed = new Set(selectedIds);
		courses = courses.filter((course) => !doomed.has(course.id));
		edges = edges.filter((edge) => !doomed.has(edge.source) && !doomed.has(edge.target));
		const next = { ...positions };
		for (const id of selectedIds) delete next[id];
		positions = next;
		selectedIds = [];
		linkSource = linkSource && doomed.has(linkSource) ? null : linkSource;
		queueSaveGraph();
	}

	function updateEdge(id: string, updates: Partial<Edge>) {
		pushHistory();
		edges = edges.map((edge) => edge.id === id ? { ...edge, ...updates } : edge);
		queueSaveGraph();
	}

	function clearEdges() {
		pushHistory();
		edges = [];
		selectedEdgeId = null;
		linkSource = null;
		queueSaveGraph();
	}

	function edgePath(edge: Edge): string {
		const source = nodeCenter(edge.source);
		const target = nodeCenter(edge.target);
		if (!source || !target) return '';
		const dx = Math.abs(target.x - source.x) * 0.45;
		return `M ${source.x} ${source.y} C ${source.x + dx} ${source.y}, ${target.x - dx} ${target.y}, ${target.x} ${target.y}`;
	}

	function edgeMidpoint(edge: Edge): Point | null {
		const source = nodeCenter(edge.source);
		const target = nodeCenter(edge.target);
		if (!source || !target) return null;
		return { x: (source.x + target.x) / 2, y: (source.y + target.y) / 2 };
	}

	function selectionRectStyle(box: NonNullable<SelectionBox>) {
		const left = Math.min(box.start.x, box.end.x);
		const top = Math.min(box.start.y, box.end.y);
		const width = Math.abs(box.end.x - box.start.x);
		const height = Math.abs(box.end.y - box.start.y);
		return `left: ${left}px; top: ${top}px; width: ${width}px; height: ${height}px;`;
	}

	function onKeydown(e: KeyboardEvent) {
		const target = e.target as HTMLElement | null;
		if (target && ['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName)) return;
		if (e.key === 'Delete' || e.key === 'Backspace') deleteSelected();
		if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'd') { e.preventDefault(); duplicateSelected(); }
		if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z' && e.shiftKey) { e.preventDefault(); redo(); }
		else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); undo(); }
		if (e.key === 'Escape') { selectedIds = []; selectedEdgeId = null; linkSource = null; tool = 'select'; selectionBox = null; }
	}
</script>

<svelte:window onpointermove={onPointerMove} onpointerup={onPointerUp} onkeydown={onKeydown} />

<div class="canvas-page">
	<div class="toolbar">
		<div class="toolbar-left">
			<h1 class="page-title font-hand">Courses</h1>
			<span class="zoom-label font-mono">{Math.round(zoom * 100)}%</span>
			<span class="save-label font-mono" class:saving={saveState === 'saving'} class:error={saveState === 'error'}>{saveState}</span>
			{#if selectedIds.length > 0}<span class="selected-label font-mono">{selectedIds.length} selected</span>{/if}
			{#if selectedEdge}<span class="selected-label font-mono">edge {selectedEdge.type}</span>{/if}
		</div>
		<div class="toolbar-right">
			<button class="tb-btn font-mono" class:active={showAddForm} onclick={() => showAddForm = !showAddForm}>+ add</button>
			<button class="tb-btn font-mono" class:active={tool === 'select'} onclick={() => { tool = 'select'; linkSource = null; }}>select</button>
			<button class="tb-btn font-mono" class:active={tool === 'link'} onclick={() => { tool = 'link'; linkSource = null; }}>link</button>
			<button class="tb-btn font-mono" onclick={undo} disabled={undoStack.length === 0}>undo</button>
			<button class="tb-btn font-mono" onclick={redo} disabled={redoStack.length === 0}>redo</button>
			<button class="tb-btn font-mono" onclick={duplicateSelected} disabled={selectedIds.length === 0}>duplicate</button>
			<button class="tb-btn font-mono" onclick={deleteSelected} disabled={selectedIds.length === 0 && !selectedEdgeId}>delete</button>
			<button class="tb-btn font-mono" onclick={organize}>organize</button>
			<button class="tb-btn font-mono" onclick={fitView}>fit</button>
			<button class="tb-btn font-mono" onclick={refreshFromServer}>sync</button>
			<button class="tb-btn font-mono" class:active={showHelp} onclick={() => showHelp = !showHelp}>help</button>
			<button class="tb-btn font-mono tb-btn-light" onclick={clearEdges}>clear links</button>
		</div>
	</div>

	{#if showAddForm}
		<div class="add-form">
			<input type="text" placeholder="Code" class="af-input code-input" bind:value={addCode} onkeydown={(e) => { if (e.key === 'Enter') addNewCourse(); }} />
			<input type="text" placeholder="Course name" class="af-input" bind:value={addName} onkeydown={(e) => { if (e.key === 'Enter') addNewCourse(); }} />
			<button class="tb-btn font-mono" onclick={addNewCourse}>add</button>
		</div>
	{/if}

	{#if tool === 'link'}
		<div class="link-hint font-mono">{linkSource ? `linking from ${coursesById[linkSource]?.code ?? linkSource} - click target` : 'click a node to start a link'}</div>
	{/if}

	{#if showHelp}
		<div class="help-card font-mono">
			<strong>Canvas controls</strong>
			<span>drag node - move</span>
			<span>drag canvas - pan</span>
			<span>shift-drag canvas - box select</span>
			<span>shift/cmd-click - multi-select</span>
			<span>double-click canvas - add course</span>
			<span>delete - remove selected</span>
			<span>cmd/ctrl-z - undo</span>
			<span>esc - clear selection</span>
		</div>
	{/if}

	<div class="editor-shell">
		<div
			class="canvas-stage"
			onpointerdown={onBgPointerDown}
			ondblclick={onCanvasDblClick}
			onwheel={onWheel}
			style="cursor: {isPanning ? 'grabbing' : (tool === 'link' ? 'crosshair' : 'grab')}"
			role="application"
			aria-label="Freeform course graph canvas"
		>
			<div class="canvas-world" style="transform: translate({panX}px, {panY}px) scale({zoom})">
				<svg class="grid-svg" viewBox="0 0 {WORLD_W} {WORLD_H}" aria-hidden="true">
					<defs>
						<pattern id="grid" width={GRID} height={GRID} patternUnits="userSpaceOnUse">
							<circle cx={GRID / 2} cy={GRID / 2} r="0.8" fill="var(--ink-faint)" opacity="0.22" />
						</pattern>
					</defs>
					<rect width="100%" height="100%" fill="url(#grid)" />
				</svg>

				<svg class="edge-layer" viewBox="0 0 {WORLD_W} {WORLD_H}" aria-hidden="true">
					<defs>
						<marker id="arrowhead" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto" markerUnits="strokeWidth">
							<path d="M 0 0 L 8 4 L 0 8 z" fill="var(--ink-soft)" />
						</marker>
					</defs>
					{#each edges as edge}
						<path class:selected-edge={selectedEdgeId === edge.id} d={edgePath(edge)} stroke="var(--ink-soft)" stroke-width="3" stroke-linecap="round" fill="none" opacity="0.9" marker-end={edge.directed ? 'url(#arrowhead)' : undefined} />
					{/each}
				</svg>

				{#each edges as edge}
					{@const mid = edgeMidpoint(edge)}
					{#if mid && edge.label}
						<button class="edge-label font-mono" class:selected={selectedEdgeId === edge.id} style="left: {mid.x}px; top: {mid.y}px;" onclick={() => { selectedEdgeId = edge.id; selectedIds = []; }}>
							{edge.label}
						</button>
					{/if}
				{/each}

				{#each courses as course (course.id)}
					{@const pos = positions[course.id]}
					{#if pos}
						<div class="course-node" class:selected={selectedIds.includes(course.id)} class:link-source={tool === 'link' && linkSource === course.id} style="left: {pos.x}px; top: {pos.y}px; width: {NODE_W}px; height: {NODE_H}px; background: {nodeFill(course)};" onpointerdown={(e) => onNodePointerDown(e, course.id)} role="button" tabindex="0" aria-label="{course.code}: {course.name}">
							<span class="cn-code font-mono">{course.code}</span>
							<span class="cn-name">{course.name.length > 24 ? course.name.slice(0, 22) + '…' : course.name}</span>
							<span class="cn-meta font-mono">{courseLabel(course)} · {course.tag ?? 'core'}</span>
						</div>
					{/if}
				{/each}

				{#if selectionBox}
					<div class="selection-box" style={selectionRectStyle(selectionBox)}></div>
				{/if}
			</div>

			<div class="minimap" aria-hidden="true">
				<svg viewBox="0 0 1200 800">
					{#each courses as course}
						{@const pos = positions[course.id]}
						{#if pos}<rect x={pos.x / 5} y={pos.y / 5} width={NODE_W / 5} height={NODE_H / 5} rx="2" fill="var(--ink-soft)" opacity={selectedIds.includes(course.id) ? 0.9 : 0.35} />{/if}
					{/each}
				</svg>
			</div>
		</div>

		<aside class="inspector">
			<h2 class="inspector-title font-mono">Inspector</h2>
			{#if selectedCourse && selectedId}
				<label>Code <input value={selectedCourse.code} oninput={(e) => updateCourseField(selectedId, { code: e.currentTarget.value.toUpperCase() })} /></label>
				<label>Name <input value={selectedCourse.name} oninput={(e) => updateCourseField(selectedId, { name: e.currentTarget.value })} /></label>
				<label>Semester
					<select value={selectedCourse.semesterId} onchange={(e) => updateCourseField(selectedId, { semesterId: e.currentTarget.value })}>
						{#each semesters as semester}<option value={semester.id}>{semester.term} {semester.year}</option>{/each}
					</select>
				</label>
				<label>Tag
					<select value={selectedCourse.tag ?? 'core'} onchange={(e) => updateCourseField(selectedId, { tag: e.currentTarget.value })}>
						{#each TAGS as tag}<option value={tag}>{tag}</option>{/each}
					</select>
				</label>
			{:else if selectedEdge}
				<label>Label <input value={selectedEdge.label} oninput={(e) => updateEdge(selectedEdge.id, { label: e.currentTarget.value })} /></label>
				<label>Type
					<select value={selectedEdge.type} onchange={(e) => updateEdge(selectedEdge.id, { type: e.currentTarget.value as Edge['type'], label: e.currentTarget.value })}>
						<option value="related">related</option><option value="prereq">prereq</option><option value="concept">concept</option>
					</select>
				</label>
				<label class="check"><input type="checkbox" checked={selectedEdge.directed} onchange={(e) => updateEdge(selectedEdge.id, { directed: e.currentTarget.checked })} /> directed</label>
			{:else}
				<p class="inspector-empty">Select a node or edge. Shift-click for multi-select. Shift-drag empty canvas for box select. Double-click canvas to create.</p>
			{/if}
		</aside>
	</div>
</div>

<style>
	.canvas-page { position: absolute; inset: 0; max-width: none; overflow: hidden; }
	.toolbar { position: absolute; top: 1rem; left: 1rem; right: 1rem; z-index: 30; display: flex; justify-content: space-between; align-items: center; margin-bottom: 0; flex-wrap: wrap; gap: 0.5rem; pointer-events: none; }
	.toolbar-left,
	.toolbar-right,
	.add-form,
	.link-hint { pointer-events: auto; }
	.toolbar-left { display: flex; align-items: baseline; gap: 0.5rem; flex-wrap: wrap; padding: 0.45rem 0.65rem; border: 1px solid rgba(26,26,23,0.1); border-radius: 6px; background: rgba(251,248,240,0.88); backdrop-filter: blur(6px); }
	.page-title { font-size: 1.5rem; color: var(--ink); margin: 0; line-height: 1; }
	.zoom-label, .selected-label, .save-label { font-size: 0.6rem; color: var(--ink-faint); text-transform: uppercase; letter-spacing: 0.06em; }
	.selected-label { color: var(--ink-soft); }
	.save-label { padding: 0.12rem 0.35rem; border: 1px solid rgba(26,26,23,0.1); border-radius: 999px; }
	.save-label.saving { color: var(--ink-soft); background: rgba(216,255,92,0.35); }
	.save-label.error { color: #8f1d1d; background: #fee2e2; border-color: rgba(143,29,29,0.22); }
	.toolbar-right { display: flex; gap: 0.3rem; flex-wrap: wrap; }
	.tb-btn { padding: 0.35rem 0.7rem; border: 1px solid rgba(26,26,23,0.12); border-radius: 4px; background: transparent; font-size: 0.65rem; color: var(--ink-soft); cursor: pointer; text-transform: uppercase; letter-spacing: 0.06em; transition: background 0.12s, border-color 0.12s, color 0.12s; }
	.tb-btn:hover:not(:disabled) { border-color: var(--ink); color: var(--ink); }
	.tb-btn.active { background: var(--highlight); border-color: var(--ink); color: var(--ink); mix-blend-mode: multiply; }
	.tb-btn:disabled { opacity: 0.3; cursor: default; }
	.tb-btn-light { opacity: 0.5; }
	.add-form { position: absolute; top: 4.35rem; left: 1rem; z-index: 31; display: flex; gap: 0.4rem; margin-bottom: 0; align-items: center; flex-wrap: wrap; padding: 0.5rem; border: 1px solid rgba(26,26,23,0.1); border-radius: 6px; background: rgba(251,248,240,0.92); backdrop-filter: blur(6px); }
	.af-input { padding: 0.4rem 0.6rem; border: 1px solid rgba(26,26,23,0.15); border-radius: 4px; background: #fbf8f0; font-family: var(--font-body); font-size: 0.8rem; color: var(--ink); outline: none; width: 180px; }
	.code-input { width: 120px; font-family: var(--font-mono); text-transform: uppercase; }
	.link-hint { position: absolute; top: 4.35rem; left: 1rem; z-index: 31; font-size: 0.65rem; color: var(--ink-soft); margin-bottom: 0; padding: 0.3rem 0.6rem; background: var(--highlight); display: inline-block; border-radius: 3px; text-transform: uppercase; letter-spacing: 0.06em; mix-blend-mode: multiply; }
	.help-card { position: absolute; top: 4.35rem; left: 1rem; z-index: 32; display: grid; gap: 0.32rem; min-width: 245px; padding: 0.7rem 0.8rem; border: 1px solid rgba(26,26,23,0.12); border-radius: 6px; background: rgba(251,248,240,0.94); backdrop-filter: blur(6px); color: var(--ink-soft); font-size: 0.62rem; text-transform: uppercase; letter-spacing: 0.05em; box-shadow: 0 8px 28px rgba(26,26,23,0.08); pointer-events: auto; }
	.help-card strong { color: var(--ink); font-size: 0.68rem; }
	.editor-shell { position: absolute; inset: 0; display: block; }
	.canvas-stage { position: absolute; inset: 0; overflow: hidden; height: auto; min-height: 0; border: none; border-radius: 0; background: transparent; touch-action: none; user-select: none; }
	.canvas-world { position: absolute; top: 0; left: 0; transform-origin: 0 0; width: 6000px; height: 6000px; }
	.grid-svg, .edge-layer { position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; }
	.edge-layer path.selected-edge { stroke: var(--highlight); stroke-width: 5; }
	.edge-label { position: absolute; transform: translate(-50%, -50%); border: 1px solid rgba(26,26,23,0.16); border-radius: 999px; background: #fbf8f0; color: var(--ink-soft); padding: 0.12rem 0.38rem; font-size: 0.55rem; text-transform: uppercase; letter-spacing: 0.06em; cursor: pointer; }
	.edge-label.selected { background: var(--highlight); color: var(--ink); }
	.course-node { position: absolute; display: flex; flex-direction: column; justify-content: center; padding: 0.45rem 0.65rem; border: 1.2px solid var(--ink); border-radius: 5px; cursor: grab; transition: box-shadow 0.12s, border-color 0.12s; user-select: none; box-sizing: border-box; }
	.course-node:hover { box-shadow: 0 2px 8px rgba(26,26,23,0.12); }
	.course-node.selected { border-width: 2px; box-shadow: 0 0 0 3px rgba(216,255,92,0.32), 0 4px 16px rgba(26,26,23,0.14); z-index: 10; }
	.course-node.link-source { border-color: var(--highlight); border-width: 2.5px; box-shadow: 0 0 0 4px rgba(216,255,92,0.35); }
	.cn-code { display: block; font-size: 0.68rem; color: var(--ink-soft); text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 0.08rem; }
	.cn-name { display: block; font-size: 0.82rem; line-height: 1.05; color: var(--ink); font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
	.cn-meta { display: block; margin-top: 0.25rem; font-size: 0.5rem; color: var(--ink-faint); text-transform: uppercase; letter-spacing: 0.05em; }
	.selection-box { position: absolute; border: 1px dashed var(--ink-soft); background: rgba(216,255,92,0.16); pointer-events: none; }
	.minimap { position: absolute; right: 10px; bottom: 10px; width: 150px; height: 100px; border: 1px solid rgba(26,26,23,0.12); background: rgba(251,248,240,0.86); border-radius: 4px; overflow: hidden; }
	.minimap svg { width: 100%; height: 100%; }
	.inspector { position: absolute; top: 4.35rem; right: 1rem; z-index: 28; width: 230px; border: 1px solid rgba(26,26,23,0.1); border-radius: 6px; background: rgba(251,248,240,0.9); backdrop-filter: blur(6px); padding: 0.75rem; min-height: 0; max-height: calc(100vh - 5.5rem); overflow: auto; box-sizing: border-box; }
	.inspector-title { margin: 0 0 0.75rem; font-size: 0.68rem; color: var(--ink-faint); text-transform: uppercase; letter-spacing: 0.08em; }
	.inspector label { display: grid; gap: 0.25rem; margin-bottom: 0.65rem; color: var(--ink-soft); font-size: 0.7rem; }
	.inspector input, .inspector select { width: 100%; box-sizing: border-box; padding: 0.38rem 0.45rem; border: 1px solid rgba(26,26,23,0.14); border-radius: 4px; background: white; color: var(--ink); font: inherit; }
	.inspector .check { display: flex; grid-template-columns: auto 1fr; align-items: center; gap: 0.35rem; }
	.inspector .check input { width: auto; }
	.inspector-empty { color: var(--ink-faint); font-size: 0.78rem; line-height: 1.4; }
	@media (max-width: 900px) { .inspector { top: auto; bottom: 1rem; left: 1rem; right: 1rem; width: auto; max-height: 32vh; } }
	@media (max-width: 640px) { .toolbar { flex-direction: column; align-items: flex-start; } .toolbar-right { max-width: 100%; } }
</style>
