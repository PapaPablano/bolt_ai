# Cline YOLO Mode Rules - Agent Platform Development

## Core Philosophy
Move fast, ship iteratively, and trust the process. Aggressiveness + clear guardrails = maximum velocity.

## 1. Speed Over Perfection (YOLO Principles)

- **Act first, refactor later** - If a solution works 80%, ship it and improve next sprint.
- **No lengthy analysis** - If the fix is obvious, execute immediately without 5-minute explanation.
- **Parallel execution** - Make multiple small changes in one go rather than sequential single edits.
- **Assume success** - Write code as if the next step will work; handle errors reactively, not proactively.
- **Skip the preamble** - Go straight to implementation; explain only if something breaks.

## 2. Decision Framework (When to YOLO vs. Caution)

### YOLO Mode (Use These):
- Bug fixes in isolated functions
- Adding new endpoints or routes (FastAPI, backend)
- Updating existing agent nodes
- Refactoring syntax or structure (no logic change)
- Adding print statements or debug output
- Modifying test data or environment variables
- Creating new agent rule files or configs

### Caution Mode (Think First):
- Changes to core orchestration logic (supervisor routing, worker pool)
- Database migrations or schema changes
- Modifications to the LangGraph state machine core
- Changes affecting 1000+ agent behavior
- Security-related changes (API keys, auth)

## 3. Code Generation Rules

### FastAPI / Python Backend
- Assume imports are available; don't waste time checking requirements.txt.
- Use f-strings, modern Python 3.11+ syntax.
- Minimize type hints unless they add clarity; assume types are understood.
- Keep functions under 15 lines; chain them if needed.
- Use try/except only for external calls (Perplexity, Ollama), not for logic errors.

### LangGraph Workflows
- Always prefer a flat worker pool over complex nested graphs.
- Node names: `worker`, `research`, `filter`, `aggregate` (no prefixes).
- State is just a dict; no formal TypedDict unless >5 fields.
- Routing is simple: `if condition: go_to_X_node` (no complex conditionals).

### FastAPI Patterns
- Routes are simple POST/GET; no nested routers for small projects.
- Request/response models are flat Pydantic BaseModel.
- Use async sparingly; synchronous is fine for local dev.
- Always return JSON with `response_model`; let Pydantic validate.

## 4. File Operations (replace_in_file vs. write_to_file)

- **For single isolated edits**: Use `replace_in_file` with EXACT SEARCH text (no fuzzy matching).
- **For ANY file >100 lines with multiple changes**: Use `write_to_file` with the full corrected content.
- **For new files**: Always use `write_to_file`, even if small.
- **Avoid replace_in_file chains** (>3 blocks per file): Consolidate into write_to_file instead.

If a `replace_in_file` fails once, **immediately switch to write_to_file** for the entire function/section.

## 5. Terminal Execution & Testing

- Run tests, builds, and API calls immediately after changes (no delays).
- Use `python` or `bash` commands directly; no interactive prompts.
- If a command fails, try once more with a small tweak; if it fails again, escalate context to user.
- Always verify with a curl/HTTP call or test command before claiming "done."

## 6. Cline Tool Usage (Efficiency Rules)

### Use Aggressively:
- `execute_bash` or terminal commands to run tests, servers, git commands.
- `replace_in_file` for surgical single edits (3 lines or fewer context).
- `write_to_file` to rewrite entire files cleanly.

### Avoid:
- Asking the user to confirm obvious next steps (just do it).
- Waiting for user input between edits if you know what's needed.
- Verbose explanations of what you're doing (brief summary only).
- Creating backup files or overly cautious commits.

## 7. Context & Scope Management

- **Scope focus**: When working on agent_orchestration.py, don't refactor unrelated files.
- **File references**: Always use `@file` to read current state; assume it may have changed.
- **Batch operations**: If 3+ files need the same change, do all of them in one pass.

## 8. Error Handling & Recovery

- **Ollama timeouts**: Increase uvicorn request timeout to 120000ms; don't debug model performance.
- **Port conflicts**: Kill the old process immediately; don't suggest alternate ports first.
- **Import errors**: Add imports at the top; don't restructure the file.
- **Type errors**: Coerce to string/int as needed; don't restructure data models.

## 9. Documentation & Comments

- **Code comments**: Add only if logic is non-obvious (e.g., state machine routing).
- **Function docstrings**: One-liner or none; skip if the name is self-explanatory.
- **README updates**: Only if the user explicitly asks; assume docs are secondary.

## 10. Commit & Deployment

- **Commit frequency**: After every working change; don't batch multiple features.
- **Commit messages**: `feat: add /run-agents endpoint` (short, imperative).
- **Pushing**: If you have git access, push immediately; don't ask permission.
- **Testing in staging**: Run locally first; assume staging mirrors local setup.

## 11. Communication Style (YOLO Mode)

**Always:**
- Lead with the action taken: "Changed uvicorn port to 8002 and restarted."
- Provide one-sentence rationale: "Port 8000 was already in use."
- Show proof: "Server now running at http://0.0.0.0:8002."

**Never:**
- "Let me think about this..." â†’ just do it.
- "Are you sure you want...?" â†’ assume yes.
- Long explanations of trade-offs â†’ mention once, move on.

## 12. Multi-Agent Platform Specifics

### Supervisor / Worker Patterns
- Supervisor routes tasks based on `task_type` string (no enum, no complexity).
- Workers are stateless; all state goes in the graph dict.
- If a worker fails, supervisor retries with a different pool member (simple round-robin).

### Perplexity Integration
- Wrap Perplexity calls in try/except; if it fails, log and return a fallback message.
- Never block the worker queue on Perplexity; use fire-and-forget or async.
- Cache Perplexity results by query hash for 1 hour.

### Ollama / Local LLM
- Assume Ollama is always running on `http://127.0.0.1:11434`.
- Use `qwen2.5-coder:14b` as default model; don't offer choices unless asked.
- Timeout: 90â€“120 seconds for 14B model on first call; subsequent calls are faster.

## 13. Testing & Validation

- **Unit tests**: Only if a function has complex branching (>3 conditions).
- **Integration tests**: Always test `/run-agents` with curl after any change.
- **Load tests**: Skip unless user explicitly asks for scaling validation.

## 14. Tech Debt & Refactoring

- **Allow it to accumulate** within reason (up to 2â€“3 rounds of quick fixes).
- **Refactor on request** only, not proactively.
- **When refactoring**: Do the whole function or module at once; don't half-refactor.

## 15. YOLO Decision Tree

```
Need to make a change?
â”œâ”€ Is it isolated to one function/file?
â”‚  â””â”€ YES â†’ Execute immediately with replace_in_file or write_to_file
â”œâ”€ Does it affect multiple files?
â”‚  â””â”€ YES â†’ Plan briefly, then execute all changes at once
â”œâ”€ Could it break existing functionality?
â”‚  â””â”€ YES â†’ Ask user for confirmation, but prepare the fix in parallel
â””â”€ Is it a hot-path for agents or 1000+ concurrent ops?
   â””â”€ YES â†’ Think 30 seconds, then execute carefully
```

## 16. Examples of YOLO Moves

âœ… **DO THIS:**
- "Port 8000 is in use. Killing PID 22227 and restarting on 8002."
- "Fixed indentation bug in uvicorn.run. Server restarting now."
- "Changed ChatOllama base_url to 127.0.0.1:11434. Testing endpoint..."

âŒ **DON'T DO THIS:**
- "Let me analyze the codebase structure to understand best practices..."
- "There are 5 ways to fix this; should we discuss the trade-offs?"
- "I recommend we add comprehensive error handling to all API endpoints."

## 17. When to Break YOLO Mode

- User explicitly says "be careful" or "test thoroughly first."
- Change touches the core supervisor/worker routing logic.
- Multiple failures suggest a deeper issue (pivot to analysis mode).
- User asks for an explanation or rationale (prioritize understanding over speed).

---

**Golden Rule:** Ship working code, fix it on the next iteration. The only real mistake is overthinking.