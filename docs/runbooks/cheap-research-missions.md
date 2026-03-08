# Cheap Research Missions Runbook

## Goal
Run deterministic public-web research missions at low cost using configurable providers and runtime adapters.

## Required Environment Variables
Set only the providers you plan to use.

- `OLLAMA_BASE_URL` (optional, default `http://127.0.0.1:11434`)
- `GROQ_API_KEY`
- `OPENROUTER_API_KEY`
- `GOOGLE_API_KEY`
- `OPENAI_API_KEY`
- `ANTHROPIC_API_KEY`

If a selected provider is not configured/reachable, runtime fails fast with deterministic explicit errors.

## Config Files
- `control-plane/llm/policy.json`
- `control-plane/llm/models.json`

Edit these files to control cheap-first routing and default model selection by provider.

## Ollama-Only Mode
1. Ensure Ollama is running locally.
2. Set routing policy defaults/tasks to `ollama`.
3. Ensure `models.json` has an `ollama` default model.
4. Run mission workflow using task hooks (`tool.*`, `llm.generate`, `output.*`).

## Enabling Groq / OpenRouter / Google
1. Set provider API key env vars.
2. Update `policy.json` mappings (`summarization`, `analysis`, etc.) to desired providers.
3. Ensure each mapped provider has a default model in `models.json`.
4. Re-run mission workflow.

## Running Cheap Research Missions
Typical deterministic DAG sequence:
1. `tool.web_search`
2. `tool.page_fetch`
3. `tool.reader_extract`
4. `llm.generate` (usually `json` or `best-effort-json`)
5. `output.write_csv` and/or `output.write_xlsx`

## Verification Checklist
- Routing follows policy precedence.
- Outputs are deterministic across repeated runs with same inputs.
- Artifacts are written only if declared.
- Source registry contains deduplicated lexicographically sorted source list.
- Tests pass for `runtime/llm`, `runtime/tools`, `runtime/output`, and integration flow.
