# AGENTS.md

## Project

Ray|Works is a collection of enterprise applications built on Microsoft Rayfin (Fabric Apps).

- `rayforms/` contains Ray|Forms, an enterprise form builder and response-management app.
- `raylive/` contains Ray|Live, a live Q&A, polling, and quiz app.
- Shared brand assets and design guidance live at the repository root.

Read and follow the app-specific `AGENTS.md` before changing files under `rayforms/` or
`raylive/`.

## Commits

- Use Conventional Commits, for example `feat(forms): add form templates` or
  `fix(live): preserve audience theme contrast`.
- Make focused, individual commits for logically distinct changes. Do not combine shared branding,
  Ray|Forms, Ray|Live, or unrelated maintenance in one commit.
- Use concise imperative subjects and add a scope when the change belongs to one app or subsystem.
- Do not commit generated output, local environment files, deployment state, or unrelated worktree
  changes.
