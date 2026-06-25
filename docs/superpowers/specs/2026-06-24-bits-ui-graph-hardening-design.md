# Bits UI Foundation and Graph Hardening Design

## Scope

Establish Bits UI as Synapse's application-wide primitive foundation, migrate Ekas-owned UI to that foundation, harden the Course Linker and Knowledge Graph, and audit the codebase for technical and UI inconsistencies.

This work must preserve the existing Field Notebook visual language. It is an interaction, accessibility, consistency, and reliability migration rather than a redesign.

`FEATURES.md` assigns Frontend UI and Course Linker & Knowledge Graph to Ekas. Those areas are in scope. Demi-owned features, database code, parser code, grade analytics, and their associated routes or tests must not be modified. Shared UI infrastructure may be created for both owners to consume, but migrating demi-owned consumers requires coordination and will be reported rather than implemented.

## Architecture

Bits UI imports will be confined to `src/lib/components/ui/**`. Pages, routes, layouts, and feature components must not import `bits-ui` directly.

The UI directory will contain project-level components with deliberate Synapse APIs and styling. These components are not a single generic pass-through wrapper. Each component owns the relevant Bits UI composition, Field Notebook classes, accessibility defaults, and supported variants.

Initial foundation:

- Button and link-button
- Text input and textarea
- Label and field-error presentation
- Checkbox
- Select
- Dialog
- Alert dialog
- Dropdown menu
- Popover
- Tooltip
- Tabs
- Toggle and toggle group
- Toolbar
- Collapsible
- Separator

Only primitives used by the current application will be added during this migration. Components that do not have a current consumer will not be created.

Feature-specific compositions remain near their feature. For example, graph controls may compose shared Button, Select, Dropdown Menu, Alert Dialog, and Toolbar components under `course-flow/**`, but they will not import Bits UI themselves.

## Migration Strategy

The migration will proceed by interaction risk:

1. Install Bits UI and create the shared UI foundation.
2. Replace hand-built dialogs, alert dialogs, dropdown menus, checkboxes, selects, toggles, and collapsibles in Ekas-owned UI.
3. Replace remaining buttons and fields with project UI components where doing so preserves native form behavior.
4. Remove obsolete local event handling and styles created redundant by the migration.
5. Audit permitted pages for inconsistent control sizing, focus treatment, disabled states, touch targets, labels, and responsive overflow.

Native semantic elements remain acceptable when Bits UI has no meaningful role, such as ordinary navigation links, plain static labels, and graph-library internals. The goal is a Bits UI foundation, not replacing semantics with components mechanically.

## Graph Hardening

### Persistence

Graph writes will use one serialized save path. Each save will:

- capture the exact persisted graph payload;
- expose saving, saved, and failed states;
- validate HTTP success;
- retain the failed payload for retry;
- prevent an older request from overwriting the visible status of a newer request;
- flush pending graph changes when appropriate before the page is discarded.

Course mutations will validate responses before committing local state where practical. Optimistic updates that fail will restore the previous local state and show an actionable error.

### Course Creation and Duplication

Course creation will no longer identify the new course by the sentinel code `NEW`. The created course ID will be returned through the local operation and used for subsequent updates.

Duplicating courses must persist the duplicated course records before graph state references them. Partial failures must not leave graph-only nodes that disappear after refresh.

### Deletion

Destructive graph actions will use the shared Alert Dialog rather than `window.confirm`.

Deleting nodes will:

- confirm the exact affected courses;
- validate each server deletion;
- avoid removing failed deletions locally;
- remove only edges belonging to successfully deleted nodes;
- surface partial failure clearly.

Deleting edges and clearing links will remain graph-state operations, with confirmation for clearing all links.

### Undo and Redo

History entries will be immutable graph snapshots rather than shallow array copies. Restoring history must not retain references to later-mutated node or edge data.

History will cover graph mutations performed in the editor. Server-backed course deletion cannot be presented as safely undoable unless the course record can also be restored; destructive course deletion will therefore clear incompatible history or explicitly remain outside undo.

### Graph Integrity

The client will reject:

- self-links;
- exact duplicate links;
- malformed relations with empty endpoints;
- relations whose source or target does not exist;
- invalid viewport values;
- non-finite node positions.

Normalization will preserve valid metadata while applying deterministic defaults. Random IDs will be created only for genuinely new client-side relations, not repeatedly while reading malformed persisted data.

Validation will continue to report prerequisite ordering, overloaded semesters, unplaced courses, and orphan relations. Interactive findings will use native buttons rather than clickable `div` elements.

### Accessibility and Interaction

Graph toolbar controls will use the shared Toolbar, Toggle Group, Button, Dropdown Menu, Tooltip, and Select components where appropriate.

Requirements:

- keyboard-operable controls with visible focus;
- menu arrow-key navigation and focus return;
- dialog focus trapping, Escape handling, and focus restoration;
- accessible names for icon-only controls;
- minimum practical touch targets;
- status announcements for saves and errors;
- no non-native `role="button"` controls when a real button can be used;
- graph nodes retain XYFlow selection and dragging behavior while exposing a clear accessible name.

### Edge and Panel Editing

Edge editing will use shared field controls. Changes will be committed intentionally rather than sending a history entry and graph save on every keystroke where that creates noisy or fragile state.

Inspector, health, suggestion, help, and add-course surfaces will have consistent close behavior, headings, overflow handling, and narrow-screen layout. Mutually exclusive panels will be managed explicitly.

## Audit

After migration, run a code-level audit covering:

- accessibility;
- performance and unnecessary rendering;
- theming and hard-coded visual values;
- responsive behavior and overflow;
- UI consistency and anti-patterns;
- error, loading, empty, and disabled states;
- TypeScript and Svelte correctness;
- duplicated or contradictory interaction logic.

Fix P0, P1, and relevant P2 findings in Ekas-owned code when they are direct consequences of this migration or graph hardening. Report demi-owned findings without changing them. Avoid unrelated cleanup.

The final report will include severity, file location, impact, recommendation, positive findings, and any ownership exclusions.

## Verification

Success requires:

- no direct `bits-ui` imports outside `src/lib/components/ui/**`;
- no remaining hand-built dialogs or dropdown menus in migrated Ekas-owned UI;
- no `window.confirm` in the graph feature;
- graph creation, duplication, deletion, connection, save retry, undo, and redo behavior verified;
- keyboard and focus behavior verified for migrated overlays and menus;
- `pnpm check` passes;
- formatter and ESLint pass for changed files;
- relevant Vitest tests pass;
- production build passes;
- Svelte autofixer reports no issues for changed Svelte files when the mandated MCP tool is available.

The Svelte MCP tools are not exposed in the current session. Local Svelte diagnostics will be used, and this limitation will be reported if the tool remains unavailable.

## Explicit Non-Goals

- No redesign of the Field Notebook visual system.
- No database schema or data-layer refactor.
- No changes to syllabus parsing, grade analytics, or other demi-owned behavior.
- No speculative UI components without current consumers.
- No broad formatting or unrelated refactoring.
