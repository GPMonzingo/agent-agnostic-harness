# Atelier office and Codex connection

The components are separate:

- `vscode-extension/`: Ollama repository chatbot and workspace skills. Install `agent-harness-chat-2.2.0.vsix` using **Extensions: Install from VSIX**. Select `devstral2-24b-instruct` in `agentHarness.model`.
- `office/`: browser visualization. Run `npm run office`, then open http://127.0.0.1:4310. Select an agent to customize its sprite, outfit, suite tiles and decoration. Preferences persist in this browser. Drag the exterior to orbit; scroll to zoom.
- `src/core/` and `harness/`: execution and repository context. The office observes execution; it is not an autonomous goal runner.

## Ollama

`npm run ollama:devstral` checks/starts Ollama and loads the installed model through its HTTP API. Docker is no longer required. The command returns after loading; chat through the extension or Open WebUI. Append `-- -WebUI` to explicitly start Open WebUI (Docker must be running), or `-- -CheckOnly` to verify without loading. Other loaded models are not forcibly evicted.

## Existing Codex extension sessions

No key or Codex configuration change is needed for the local observer. It reads the latest 20 session files from `CODEX_HOME/sessions`, defaulting to `~/.codex/sessions`, every two seconds. Select the desired session by workspace and session ID. Already-running sessions appear if they write logs here; remote sessions whose logs are elsewhere will not.

This adapter reads an internal log format and is experimental. It does not expose auth files, encrypted reasoning or tool inputs. Public progress, latest user requests, lifecycle events and reported token counts appear locally. It cannot reconstruct the exact live model context window.

Turn start means working; completion/interruption means idle. After the configured idle delay, the agent sleeps on the residence floor. A two-minute gap in active telemetry means **unknown**, not completion. Turn completion does not prove a long-running goal finished. The office does not interrupt or resume existing sessions. Bubbles show public progress, never private reasoning.

## Other agents and office events

Import `recordEvent` from `office/events.mjs` in another Node runner and write to the local `office/events.jsonl`. Required fields: `agentId`, `state`. Optional: `name`, `summary`, `goal`, `contextId`, `participants`, `capabilities`. States: working, research, meeting, onboarding, handoff, idle, blocked.

```js
import { recordEvent } from './office/events.mjs';
await recordEvent('office/events.jsonl', {
  agentId: 'reviewer', name: 'Reviewer', state: 'meeting',
  participants: ['codex', 'reviewer'], contextId: 'review-42',
  summary: 'Reviewing the proposed migration'
});
```

Emit a meeting event for each participant to move them into the meeting room. Emit onboarding with capabilities actually installed by the runner; emit handoff with a shared context ID. These events visualize actions; they do not install logging, pass context or summon agents themselves. For manual events: `node scripts/office-event.mjs reviewer idle Review finished`.

## Bidirectional Codex integration

Use the official [Codex App Server](https://learn.chatgpt.com/docs/app-server) for office-owned sessions: initialize, start/resume a thread, start a turn, consume lifecycle/item/public-message/tool notifications, and preserve approvals. Only successful completion means success. Do not assume a separate app-server can attach to the extension's active transport or inherit its in-flight context.

An office vocabulary skill could map library visits to repository search, meetings to real delegation, and projects to tracked goals. The runner must implement the actions and publish events. This execution bridge and vocabulary skill are not implemented in this release.

## Hosting and limitations

The server binds to loopback and rejects unexpected Host headers. Publishing at agents.robertjmonzingo.com needs an authenticated backend and an explicit filtered telemetry relay. No deployment or DNS was changed.

The exterior is an interactive architectural 3D rendering, not a photorealistic asset. Decoration uses presets, not free furniture placement. Session observation cannot guarantee exact synchronization with a live goal.

## Checks

`npm run build`, `npm run office:test`, `npm run extension:package`. Browser checks cover live session display, floor selection, customization and the WebGL exterior.
