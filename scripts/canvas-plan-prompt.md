You are a senior engineer. Produce an extremely detailed, strict implementation plan for building a freeform drag-and-drop course graph canvas in a SvelteKit app (Svelte 5 runes mode). This is PLANNING ONLY — do not write code.

## Project Context

Synapse is a student dashboard. The courses page at `/app/courses` currently has three views (SVG graph, linker, timeline) built with a column-based layout that forces assumptions. We're replacing them with a single freeform drag canvas — think Excalidraw meets academic planning.

Tech stack: Svelte 5 (runes: $state, $derived, $effect), TypeScript, Tailwind CSS v4, Cloudflare adapter. No canvas libraries — pure SVG/HTML. Design language: field notebook (paper #f3ead7, ink #1a1a17, highlight #d8ff5c, hand-drawn aesthetic). Data is served from in-memory JSON files via SvelteKit API routes (`/api/semesters`, `/api/courses`).

Existing data model:

```ts
type Semester = { id: string; term: string; year: number; order: number };
type Course = {
	id: string;
	semesterId: string;
	code: string;
	name: string;
	instructor?: string;
	credits?: number;
};
```

## What to Plan

A single-page freeform canvas with these features:

### 1. Canvas

- Full-page scrollable/zoomable area
- Semester boundaries as dashed-background columns (resizable based on which courses are inside them)
- Courses appear as movable cards (polaroid-style, like the landing page)
- Grid snap optional (show on "organize")

### 2. Course Nodes

- Each course is a draggable card showing code + name
- Drag with pointer events (pointerdown/pointermove/pointerup)
- Position is stored per-course in state (x, y)
- Drop shadow on drag, snap-back animation on release
- Click to expand/collapse inline details (instructor, credits, edges)

### 3. Edges / Linking

- Toggle "link mode" button
- In link mode: click source node, drag a hand-drawn-style bezier curve to target node
- Edge snaps to both nodes on release
- Edges follow nodes when dragged (re-routing)
- Edges stored as `{ source: string, target: string }` in state
- Highlight edge on hover, click to delete

### 4. Semester Boundaries

- Dashed-border rectangles behind course groupings
- Courses can be dragged across semester boundaries (moves to that semester)
- "Organize" button re-sorts courses into semester columns, untangles edges

### 5. Add Course

- "+" button opens an inline form floating on the canvas
- Enter code + name → creates a course node at a default position
- Saves to API via POST /api/courses

### 6. Organize Button

- Algorithm: lay out semesters as columns, courses stacked vertically within each semester
- Edge crossing minimization: sort courses within semesters by total connections
- Animated transition (CSSTransition or FLIP)

### 7. Edge Cases to Handle

- Empty canvas state (no courses yet)
- Single course (no edges, centered)
- Course removed from semester but still has edges (orphan edges cleaned up)
- Two courses at the exact same position (push apart on organize)
- Semester with 0 courses after drag-out (hide empty column)
- Long course names (text truncation with ellipsis)
- Mobile: single-column layout, no drag (tap to select, buttons to move)
- Canvas boundaries: prevent dragging off-screen
- Performance: 50+ courses, 100+ edges — SVG should still be responsive

## Output

Produce a detailed, strict plan with:

1. **File list** — every file to create/modify with exact path
2. **Component tree** — parent-child hierarchy
3. **State shape** — exact TypeScript types for canvas state
4. **Data flow** — how state updates propagate (add course → state + API)
5. **Step-by-step implementation order** — numbered steps, each with success criteria
6. **Edge cases checklist** — every edge case listed with its handling strategy

Be extremely specific. Assume the implementer will follow every instruction literally.
