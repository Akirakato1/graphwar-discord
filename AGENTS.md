# Personal Preferences

- Do not add `Co-Authored-By` trailers to commit messages. Author commits as the user only.

# Graphify Workflow

- Treat `graphify-out/graph.json` and `graphify-out/GRAPH_REPORT.md` as the project map.
- At the start of a new context session, when project structure, architecture, code relationships, or where-to-edit questions come up, consult the graph before broad manual searching.
- Prefer `graphify query`, `graphify path`, or `graphify explain` for architecture/navigation questions when `graphify-out/graph.json` exists.
- If the graph is missing, stale, or project structure has changed, run graphify before relying on it.
- Whenever code or docs changes materially alter project structure, relationships, or workflow instructions, update the graph as part of the same work.
- Use graphify as a standing workflow pattern, similar to using superpowers for planning, brainstorming, debugging, and verification.

# UI Design Workflow

- For UI work, run a design audit before implementation: use graphify to locate the relevant menu, lobby, HUD, canvas, input, and style files, then inspect the current screens before editing.
- Make all menu and gameplay screens feel like one professional product: consistent color palette, typography, spacing, shape language, borders, focus states, hover/active states, and disabled states.
- Replace default browser-looking controls where appropriate. Dropdowns, sliders, text inputs, buttons, toggles, and modal controls should have cohesive CSS styling that matches the game UI.
- Use icons, compact symbols, and visual affordances when they simplify controls or reduce text clutter, while keeping labels clear for unfamiliar actions.
- Use images or rendered visual assets when they materially improve comprehension or polish, especially for game identity, empty states, map/gameplay context, or player-facing UI.
- Preserve Discord Activity constraints: all screens must fit a 16:9 no-scroll viewport, including phone landscape layouts. Hide, compress, or reprioritize nonessential panels when space is tight.
- Verify UI changes with screenshots at desktop 16:9 and phone-landscape-like sizes, checking for overflow, text clipping, awkward default styling, low contrast, and inconsistent component treatments.
- After structural UI changes, update graphify so future sessions can navigate the latest screen/component relationships.
