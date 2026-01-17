# UI Design

> This doc illustrates the design of the interactive graphical user interface.
> Created at: 2026/01/17

## Goal

Our goal is to let human could easily read a book(especially historical book for now) with many events/locations/roles/timeline in a interactive and visual way. Via our service, the readers get more knowledge in more dimensions in a more fantastic and attractive way with even less time cost.

## Scope (V1)

- Time is **year-based only** (using numeric year, BCE as negative).
- The selection of **juan range + year range is the global context** shared by all views.
- Geography view must support both:
	- A location-centric experience even when coordinates are missing.
	- A map mode once coordinates are available (via a data pipeline).

## Overview

we have these elements(ref.data/unified_knowledge.json):
1. event
2. role
3. power
4. location
5. relation
6. time

We are going to demonstrate these all in our service. Each of the element has the relation to other elements, this should be represented in the interface.

## System Model

### Global Context (single source of truth)

Global Context is the shared state that all views read from and write to:

- `juanRange`: `[startJuan, endJuan]`
- `yearRange`: `[startYear, endYear]` (both nullable; year-based only; BCE is negative)
- `selection`: optional selected entity (event/role/location/relation)

Rules:

- Any view can update the Global Context.
- All views must reflect the Global Context consistently.

### Interaction Contract (consistent everywhere)

One interaction pattern across all views:

1. **Select**: user clicks an entity (event/role/location/relation).
2. **Inspect**: show a consistent entity detail (modal/panel).
3. **Jump**: user clicks a linked entity from the detail; the app updates Global Context and (if needed) switches to the most relevant view.

"Jump" is the primary way users traverse the knowledge graph without losing reading context.

### Context Navigation (Back/Forward)

Because Global Context changes as users select/jump across entities and views, the system must support easy back/forward traversal of context, similar to a browser.

V1 requirements:

- Global Context must be **URL-addressable** (e.g. query params), so context can be:
	- navigated via browser Back/Forward
	- shared/bookmarked
	- restored on refresh
- Each meaningful context change must create a history entry:
	- Tab switch
	- Global filter changes (`juanRange`, `yearRange`) when the user commits the change
	- Jump actions (entity-to-entity navigation)

History update policy:

- Use **replace** for high-frequency intermediate states (e.g. while dragging/zooming).
- Use **push** only on commit (e.g. mouseup / enter / blur) to avoid flooding history.

What is included in context navigation:

- `tab`
- `juanRange`, `yearRange`
- focus/selection identifiers (e.g. focused role id)

What is excluded (transient UI state):

- hover state
- tooltip visibility
- intermediate zoom transforms unless explicitly treated as a committed navigation

## View Based on Time/Book(linear)

### How do users select content(time/book) display range?

Use global filters:

- `juanRange` controls which parts of the book are in scope.
- `yearRange` controls which years are in scope.

Both filters are global context and must affect all tabs.

### Events display

problems:
1. time label is sparse, but events are dense at some singe time points, how to show many events in one time point in a user friendly way?
2. how do we show related roles/power... in an event? How do users interact with these elements to get more dimensional knowledge? 

V1 design decisions:

- Keep a linear timeline with **clustering** for dense events and an **expand** action for clusters.
- Event detail must show at least:
	- year/time label
	- location (if available)
	- participants
	- description (+ significance/background when available)
- Participants and related entities in the detail must be clickable and support **Jump**:
	- Clicking a participant jumps to the network view and focuses that role.

Unknown/nullable time handling:

- If an event has `time_start = null`, it should not break filtering.
- It should be shown in a clear "Unknown time" grouping or otherwise clearly separated from year-filtered events (implementation choice), so users understand why it appears.

## View Based on Geography/Map

### All entities should have a way to display on a map

### We can see a entity's location transferring on a map

V1 model:

- The geography tab supports two modes:
	- **Location-centric mode (no coordinates required)**: list + detail, driven by Global Context.
	- **Map mode (coordinates required)**: plot locations with coordinates; list remains available for missing coordinates.

Map requirements:

- Only show locations relevant to the current Global Context.
- Map must gracefully handle missing coordinates:
	- Locations without coordinates remain visible in list mode.

Entity trajectory (V1 minimal):

- For a selected entity (role/event/power), show a "trajectory" as a sequence of event locations over time, only when:
	- events have `time_start` (year), and
	- locations have coordinates.

## Search(event, time, roles like anything that could be searched)

V1 design:

- Provide a single global search entry that returns mixed entity types:
	- role / location / event
- Selecting a result should:
	- open the entity detail (Inspect)
	- optionally Jump to the best view:
		- role -> network (focus the node)
		- event -> timeline
		- location -> geography

## View-by-view Rules (V1)

### Timeline tab

- Input: Global Context (`juanRange`, `yearRange`).
- Output: events filtered by both ranges.
- Interaction:
	- click event -> Inspect (event detail)
	- click participant in detail -> Jump to network + focus

### Network tab

- Input: Global Context (`juanRange`, `yearRange`).
- Output: role graph where edges and nodes are consistent with the selected ranges.
- Filtering policy:
	- `juanRange` filters relations by source juans.
	- `yearRange` filters relations by numeric year (requires relation-year fields in data).
	- Nodes are included if they participate in at least one in-range relation.

### Locations tab

- Input: Global Context (`juanRange`, `yearRange`).
- Output:
	- list of relevant locations
	- detail shows related roles and related events within context
- Map mode (when coordinates exist): plot only in-range locations with coordinates.

### Power tab

- Input: Global Context (`juanRange`, `yearRange`).
- Output: power distribution within context.
- If time evidence for power membership is incomplete, fall back to `juanRange` only and label it clearly.

## Data & Pipeline Requirements

### Year-based time

- Events must have numeric year for filtering:
	- `events[*].time_start: number | null`
- Relations should also have numeric years to support global filtering in the network view:
	- add `relations[*].first_interaction_year: number | null`
	- add `relations[*].last_interaction_year: number | null`

#### Juan-year mapping (important invariant)

Fact:

- Each juan has a clear **start year**.
- Juans are **sequential on year** (juan index order follows time order).

Implications (V1):

- The system should maintain a canonical mapping:
	- `juan_start_year[juan_index] = year`
- Global Context can support two linked time selectors:
	- a `juanRange` selector
	- a `yearRange` selector

Sync rules (recommended):

- When user changes `juanRange`, the UI can offer (or default to) updating `yearRange` to the span implied by the selected juans.
- When user changes `yearRange`, the UI can offer (or default to) updating `juanRange` to the minimal set of juans covering that year span.

Deriving years from juans:

- If an event has `time_start = null`, it may be assigned an **imputed year range** based on its `source_juans`:
	- `imputed_start_year = min(juan_start_year[source_juan])`
	- `imputed_end_year = max(juan_start_year[source_juan] + juan_year_span_estimate)` (span can be 0 if unknown)
- Relations can similarly derive numeric years if missing:
	- `first_interaction_year = min(juan_start_year[source_juan])`
	- `last_interaction_year = max(juan_start_year[source_juan] + juan_year_span_estimate)`

Note:

- If we do not model per-juan year span yet, V1 can conservatively treat each juan as a single-year anchor (span=0). This still enables consistent global time filtering and navigation, with a clear accuracy tradeoff.

### Coordinates for map

Most `locations[*].coordinates` are currently null; map mode depends on a data pipeline.

Proposed pipeline artifact (versioned, deterministic, and override-friendly):

- `data/location_geocoding.json` (or similar), keyed by location `id` or `canonical_name`:
	- `canonical_name`
	- `modern_name` (normalized)
	- `coordinates: [lng, lat] | null`
	- `confidence` (e.g. 0-1)
	- `evidence` (short justification / references used)
	- `source` (LLM/manual)
	- optional `notes` / manual overrides

Integration rule:

- Unification should fill `UnifiedLocation.coordinates` from this artifact, so the frontend never calls LLM.

### Linking data to reading context

- Ensure each entity maintains enough provenance to connect back to the book:
	- events: `source_juans` (already exists)
	- relations: `source_juans` (already exists)
	- roles/locations: `occurrences` with `juan_index` (already exists)

This provenance is what makes Global Context filtering and "Jump" behavior reliable.

## TODO

- [ ] Make Global Context URL-addressable (`tab`, `juanRange`, `yearRange`, focus/selection)
- [ ] Add history push/replace rules (debounce/commit semantics) for context changes
- [ ] Apply `yearRange` filtering to network (requires relation numeric years)
- [ ] Extend unified relations with `first_interaction_year` / `last_interaction_year`
- [ ] Add `juan_start_year` mapping and sync policy between `juanRange` and `yearRange`
- [ ] Define V1 imputation rules for events/relations missing numeric years (juan-based anchors)
- [ ] Build `data/location_geocoding.json` pipeline to fill `UnifiedLocation.coordinates`
- [ ] Add map mode to locations view (graceful fallback for null coordinates)
- [ ] Derive and render entity trajectory from in-range events + geocoded locations