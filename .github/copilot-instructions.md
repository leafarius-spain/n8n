# 🤖 n8n Workspace Instructions

**Context**: n8n-as-code project syncing to **Rafael's personal n8n instance** at `http://192.168.0.50:5678`.

> **Source of Truth**: [AGENTS.md](../AGENTS.md) — comprehensive framework guide. This file adds **workspace-specific context** only.

---

## 🚀 Quick Reference

### Essential Commands
| Task | Command |
|------|---------|
| **Survey workflows** | `npx --yes n8nac list` — all workflows + sync status |
| **Find a node** | `npx --yes n8nac skills search "google sheets"` |
| **Node details** | `npx --yes n8nac skills node-info googleSheets` |
| **Create workflow** | Pull existing → Edit `.workflow.ts` → Push |
| **Validate locally** | `npx --yes n8nac skills validate workflow.workflow.ts` |
| **Verify live** | `npx --yes n8nac verify <workflowId>` — schema check on n8n server |
| **Test webhook** | `npx --yes n8nac test <id> --prod` (after `npx --yes n8nac workflow activate <id>`) |

### Workflow Directory Structure
```
workflows/
└── 192_168_0_50:5678_rafael_g/    ← Active instance folder
    └── personal/                   ← Project folder
        ├── My workflow.workflow.ts  ← Your workflows here
        ├── n8n-workflows.d.ts       ← Auto-generated TypeScript defs
        └── tsconfig.json            ← Workspace TypeScript config
```

**Rule**: Always create new `.workflow.ts` files inside `workflows/192_168_0_50:5678_rafael_g/personal/` — **never** in the workspace root.

---

## 🔄 Workflow Sync Protocol (Critical)

**Before editing any existing workflow:**

```bash
# 1. List to check sync status
npx --yes n8nac list

# 2. Pull if remote is newer
npx --yes n8nac pull <workflowId>

# 3. Edit the local .workflow.ts file

# 4. Validate locally (optional)
npx --yes n8nac skills validate workflow.workflow.ts

# 5. Push changes
npx --yes n8nac push <filename.workflow.ts>

# 6. Verify on live instance (recommended)
npx --yes n8nac verify <workflowId>

# 7. For webhook/chat/form workflows: activate + test
npx --yes n8nac workflow activate <workflowId>
npx --yes n8nac test <workflowId> --prod
```

> **Critical**: Always `pull` before editing existing workflows to avoid Optimistic Concurrency Control (OCC) conflicts.

---

## 📐 Workflow Example (Personal Project Pattern)

Current example: **My workflow** — web scraping + data extraction + database load

```typescript
import { workflow, node, links } from '@n8n-as-code/transformer';

@workflow({
  name: 'My workflow',
  active: false,
  settings: { executionOrder: 'v1' }
})
export class MyWorkflow {
  @node({
    name: 'When clicking "Execute workflow"',
    type: 'n8n-nodes-base.manualTrigger',
    version: 1,
    position: [-1056, -464]
  })
  ManualTrigger = {};

  @node({
    name: 'Extract Data',
    type: '@mendable/n8n-nodes-firecrawl.firecrawl',
    version: 1,
    position: [-848, -464],
    credentials: { firecrawlApi: { id: '3FsKPT3ZQeVfmMkM', name: 'Firecrawl account' } }
  })
  ExtractData = {
    resource: 'Agent',
    operation: 'agent',
    prompt: 'Your extraction prompt here',
    specifyUrls: true,
    urls: 'https://example.com'
  };

  @links()
  defineRouting() {
    this.ManualTrigger.out(0).to(this.ExtractData.in(0));
  }
}
```

---

## 🛠️ Research Protocol

**Always follow this before writing any node parameter:**

1. **Search**: `npx --yes n8nac skills search "what you want"`
2. **Node Info**: `npx --yes n8nac skills node-info <nodeName>` → Get exact schema
3. **Validate**: `npx --yes n8nac skills validate workflow.workflow.ts`
4. **Verify**: `npx --yes n8nac verify <id>` (post-push catches runtime errors)
5. **Test**: `npx --yes n8nac test <id> --prod` (for webhook/chat/form only)

> See **[AGENTS.md § 🔬 MANDATORY Research Protocol](../AGENTS.md#-mandatory-research-protocol)** for full details.

---

## ⚠️ Common Pitfalls (Quick Checklist)

- ❌ Guessing node type → Use `search` + `node-info`
- ❌ Wrong `typeVersion` → Check schema array, pick highest  
- ❌ Invalid `operation` value → Values come from `options[].value`, not your imagination
- ❌ Forgotten `.workflow.ts` suffix in push → Always include: `push myworkflow.workflow.ts`
- ❌ Editing without pull first → OCC conflict! Always pull existing workflows first
- ❌ Using `.out().to()` for AI sub-nodes (models, memory, tools) → Use `.uses()` instead
- ❌ Inverting `value1`/`value2` in Switch/If rules → `value1` = expression, `value2` = literal

> **Full list + examples**: [AGENTS.md § 🚫 Common Mistakes to AVOID](../AGENTS.md#-common-mistakes-to-avoid)

---

## 📚 Documentation Map

| Topic | Reference |
|-------|-----------|
| Full research protocol | [AGENTS.md § 🔬](../AGENTS.md#-mandatory-research-protocol) |
| Node schema lookups | [AGENTS.md § 📝](../AGENTS.md#-minimal-workflow-structure) |
| GitOps sync workflow | [AGENTS.md § 🔄](../AGENTS.md#-gitops--synchronization-protocol-critical) |
| AI workflows (agents, LLModel, memory, tools) | [AGENTS.md § AI Agent Workflow Example](../AGENTS.md#ai-agent-workflow-example-critical--follow-this-pattern-for-langchain-nodes) |
| Testing webhook workflows | [AGENTS.md § 🧪 Test](../AGENTS.md#-test-webhook-chatform-workflows-post-push) |
| Credential management | [AGENTS.md § 🔑 Credential Management](../AGENTS.md#-credential-management-resolve-class-a-gaps-without-opening-the-n8n-ui) |
| Error classification | [AGENTS.md § Error Classification](../AGENTS.md#-critical-error-classification) |

---

## 🎯 Workspace Context

| Setting | Value |
|---------|-------|
| **Active Instance** | `http://192.168.0.50:5678` (Rafael's local n8n) |
| **Project** | `personal` |
| **Sync Folder** | `workflows/` |
| **Config File** | `n8nac-config.json` (initialized ✅) |
| **TypeScript Support** | ✅ `n8n-workflows.d.ts` (auto-generated type hints) |

### Instance Setup Status
- ✅ Initialized via `npx --yes n8nac init`
- ✅ Credentials verified
- ✅ Active instance: `192_168_0_50:5678_rafael_g`

---

## 🚦 When to Use Which Tools

### Use `npx --yes n8nac` tools
- Creating, editing, or validating workflows
- Searching for nodes or examples
- Testing webhook/chat/form workflows
- Managing credentials
- Checking sync status

### Use VS Code Editor
- Reading workflow files (`.workflow.ts`)
- Understanding workflow structure
- Reviewing TypeScript types (`n8n-workflows.d.ts`)

### When to Check n8n UI Directly
- Viewing live execution history
- Manually testing in "test mode" (if needed)
- Inspecting workflow details that `verify` doesn't catch

---

## 📋 Before Creating a New Workflow

1. ✅ Check `npx --yes n8nac list --local` — does it already exist locally?
2. ✅ Run `npx --yes n8nac skills examples search` — is there a similar workflow to learn from?
3. ✅ Plan trigger type (Manual, Schedule, Webhook, Chat, etc.)
4. ✅ Research each node: `npx --yes n8nac skills search "node name"`
5. ✅ Create file in `workflows/192_168_0_50:5678_rafael_g/personal/`
6. ✅ Follow the minimal structure (see [Workflow Example](#-workflow-example-personal-project-pattern) above)
7. ✅ Validate: `npx --yes n8nac skills validate workflow.workflow.ts`
8. ✅ Push: `npx --yes n8nac push filename.workflow.ts`
9. ✅ Verify: `npx --yes n8nac verify <newWorkflowId>`
10. ✅ Test (if webhook/chat/form): `npx --yes n8nac workflow activate <id>` → `npx --yes n8nac test <id> --prod`

---

## 🔗 Quick Links

- **n8n Docs**: https://docs.n8n.io/
- **n8nac GitOps**: https://github.com/n8n/n8n-as-code
- **Workflow Examples**: Community workflows via `npx --yes n8nac skills examples search`
- **[AGENTS.md](../AGENTS.md)** ← **Start here for deep dives**
