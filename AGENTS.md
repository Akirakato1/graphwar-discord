# Personal Preferences

- Do not add `Co-Authored-By` trailers to commit messages. Author commits as the user only.

# Graphify Workflow

- Treat `graphify-out/graph.json` and `graphify-out/GRAPH_REPORT.md` as the project map.
- At the start of a new context session, when project structure, architecture, code relationships, or where-to-edit questions come up, consult the graph before broad manual searching.
- Prefer `graphify query`, `graphify path`, or `graphify explain` for architecture/navigation questions when `graphify-out/graph.json` exists.
- If the graph is missing, stale, or project structure has changed, run graphify before relying on it.
- Whenever code or docs changes materially alter project structure, relationships, or workflow instructions, update the graph as part of the same work.
- Use graphify as a standing workflow pattern, similar to using superpowers for planning, brainstorming, debugging, and verification.
