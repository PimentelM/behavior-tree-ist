---
description: update docs
---
1. Use `codebase_search` or `grep_search` to find any obsolete references in the `docs/` folder to symbols that were just renamed or refactored.
2. Ensure the newly implemented APIs or behaviour are accurately documented in the related `/docs` markdown files.
3. If new nodes were added, ensure they are documented in their respective file (e.g. `action-nodes.md`, `decorator-nodes.md`, etc.).
4. Use `multi_replace_file_content` to make these changes precisely.
