# Course Intelligence Brief Prompt Contract

The runtime prompts live in `src/lib/server/briefing/prompt.ts`.

Search workers receive exactly one category, normalized request hints, source restrictions, and a strict extraction schema. They do not recommend courses or resolve contradictions. Every returned URL must match an OpenRouter `url_citation` annotation before it enters the evidence bundle.

The synthesis worker receives only the validated evidence bundle. Retrieved text is untrusted data, not instructions. It cannot browse, add URLs, invent source IDs, turn hints into evidence, hide contradictions, or fill missing facts from memory. Official claims require official sources; RMP metrics require RMP evidence; historical evidence stays historical. Output is strict Briefing V3 JSON with no markdown or reasoning prose.
