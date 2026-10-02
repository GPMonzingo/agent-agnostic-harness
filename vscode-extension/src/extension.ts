import * as vscode from "vscode";

type ChatMessage = { role: "system" | "user" | "assistant" | "tool"; content: string; tool_call_id?: string };

export function activate(context: vscode.ExtensionContext): void {
  const provider = new ChatViewProvider(context);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider("agentHarness.chatView", provider),
    vscode.commands.registerCommand("agentHarness.openChat", () => vscode.commands.executeCommand("workbench.view.extension.agentHarness"))
  );
}

class ChatViewProvider implements vscode.WebviewViewProvider {
  private view?: vscode.WebviewView;
  private messages: ChatMessage[];
  private busy = false;
  private ollamaStartup?: Promise<void>;

  constructor(private readonly context: vscode.ExtensionContext) {
    this.messages = context.globalState.get<ChatMessage[]>("chatMessages", []);
  }

  resolveWebviewView(view: vscode.WebviewView): void {
    this.view = view;
    view.webview.options = { enableScripts: true };
    view.webview.html = this.html(view.webview);

    view.webview.onDidReceiveMessage(async (message: { type: string; text?: string }) => {
      if (message.type === "ready") { this.post({type: "restore", messages: this.messages.filter(m => m.role === "user" || m.role === "assistant").map(({role, content}) => ({role, content}))}); return; }
      if (message.type === "clear") { this.messages = []; await this.context.globalState.update("chatMessages", []); return; }
      if (message.type === "settings") { await vscode.commands.executeCommand("workbench.action.openSettings", "agentHarness"); return; }
      if (message.type === "skill") {
        const name = await vscode.window.showInputBox({prompt: "Skill name", validateInput: v => /^[a-z0-9-]+$/.test(v) ? null : "Use lowercase letters, numbers and hyphens"});
        if (name) { await this.createDirectory(`.ai/skills/${name}`); const uri = this.workspaceUri(`.ai/skills/${name}/SKILL.md`); try { await vscode.workspace.fs.stat(uri); } catch { await this.writeFile(`.ai/skills/${name}/SKILL.md`, `# ${name}\n\nDescribe when to use this skill and its instructions.\n`); } await vscode.window.showTextDocument(uri); } return;
      }
      if (message.type !== "chat" || !message.text?.trim()) return;
      await this.chat(message.text.trim());
    });
  }

  private async chat(text: string): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    try {
    const editor = vscode.window.activeTextEditor;
    const fileContext = editor ? `\n\nCurrent file (${editor.document.fileName}):\n${editor.document.getText()}` : "";
    const knowledge = await this.repositoryKnowledge();
    const prompt = `${text}${knowledge}${fileContext}`;
    if (!this.messages.some(message => message.role === "system")) {
      this.messages.unshift({ role: "system", content: "You are a coding assistant. You can edit the opened workspace with the provided tools. Use create_directory for directories and write_file for files. After editing, briefly summarize exactly what changed." });
    }
    this.messages.push({ role: "user", content: prompt });
    this.post({ type: "user", text });
    this.post({ type: "status", text: "Preparing workspace context…" });
    const config = vscode.workspace.getConfiguration("agentHarness");
    const url = `${config.get<string>("ollamaUrl", "http://127.0.0.1:11434")}/api/chat`;
    const model = config.get<string>("model", "deepseek-coder-v2-lite-instruct-q4_k_m");
    try {
      await this.ensureOllama(config.get<string>("ollamaUrl", "http://127.0.0.1:11434"));
      this.post({ type: "status", text: `Connecting to ${model}…` });
      for (let step = 0; step < 12; step++) {
        const payload = { model, messages: this.messages, stream: true, tools: this.workspaceTools() };
        let response = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
        if (response.status === 400 && step === 0) response = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ model, messages: this.messages, stream: true }) });
        if (!response.ok) throw new Error(`Ollama returned HTTP ${response.status}: ${await response.text()}`);
        type ToolCall = {id?: string; function: {name: string; arguments: unknown}};
        const result: {message: ChatMessage & {tool_calls: ToolCall[]}} = {message: {role: "assistant", content: "", tool_calls: []}};
        if (!response.body) throw new Error("Ollama returned no response stream.");
        const reader = response.body.getReader(), decoder = new TextDecoder();
        let pending = "";
        const consume = (line: string): void => {
          if (!line.trim()) return;
          const chunk = JSON.parse(line) as {error?: string; message?: {content?: string; tool_calls?: ToolCall[]}};
          if (chunk.error) throw new Error(chunk.error);
          if (chunk.message?.content) { result.message.content += chunk.message.content; this.post({type: "assistantDelta", text: chunk.message.content}); }
          if (chunk.message?.tool_calls) result.message.tool_calls.push(...chunk.message.tool_calls);
        };
        try {
          while (true) {
            const {value, done} = await reader.read();
            pending += decoder.decode(value, {stream: !done});
            const lines = pending.split("\n"); pending = lines.pop() || "";
            lines.forEach(consume);
            if (done) { consume(pending); break; }
          }
        } finally { reader.releaseLock(); }
        this.messages.push(result.message);
        const calls = result.message.tool_calls || [];
        if (!calls.length) break;
        for (const call of calls) {
          const args = (typeof call.function.arguments === "string" ? JSON.parse(call.function.arguments) : call.function.arguments) as {path?: string; content?: string};
          let output: unknown;
          try {
            switch (call.function.name) {
              case "list_files": output = await this.listFiles(args.path || ""); break;
              case "read_file": output = await this.readFile(args.path || ""); break;
              case "create_directory": await this.createDirectory(args.path || ""); output = "Directory created"; break;
              case "write_file": await this.writeFile(args.path || "", args.content || ""); output = "File written"; break;
              default: output = "Unknown tool";
            }
          } catch (error) { output = String(error); }
          this.messages.push({role: "tool", content: JSON.stringify(output), tool_call_id: call.id});
          this.post({type: "status", text: `Completed ${call.function.name} · step ${step + 1}/12`});
        }
        if (step === 11) this.post({type: "assistantDelta", text: "\nTool-step limit reached. Send another message to continue."});
      }
      await this.context.globalState.update("chatMessages", this.messages);
    } catch (error) {
      this.post({ type: "error", text: `Ollama request failed. Make sure the configured model is available.\n\n${String(error)}` });
    } finally { this.post({ type: "status", text: "" }); }
    } catch (error) { this.post({ type: "error", text: String(error) }); } finally { this.busy = false; this.post({ type: "status", text: "" }); }
  }

  private ensureOllama(baseUrl: string): Promise<void> {
    if (this.ollamaStartup) return this.ollamaStartup;
    this.ollamaStartup = (async () => {
      const healthUrl = `${baseUrl.replace(/\/$/, "")}/api/tags`;
      try {
        const response = await fetch(healthUrl);
        if (response.ok) return;
      } catch {
        // Ollama is not running yet; start it below.
      }

      const terminal = vscode.window.createTerminal({ name: "Agent Harness · Ollama", cwd: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath });
      terminal.show(true);
      terminal.sendText("ollama serve", true);
      this.post({ type: "status", text: "Starting Ollama and loading the model…" });

      for (let attempt = 0; attempt < 60; attempt++) {
        await new Promise(resolve => setTimeout(resolve, 2000));
        try {
          const response = await fetch(healthUrl);
          if (response.ok) return;
        } catch {
          // Keep waiting while the npm script starts Docker/Ollama.
        }
      }
      throw new Error("Ollama did not become ready within two minutes.");
    })().catch(error => {
      this.ollamaStartup = undefined;
      throw error;
    });
    return this.ollamaStartup;
  }

  private post(message: unknown): void { this.view?.webview.postMessage(message); }

  private workspaceTools(): unknown[] {
    const path = { type: "string", description: "Workspace-relative path." };
    return [
      { type: "function", function: { name: "list_files", description: "List files in a workspace directory before editing.", parameters: { type: "object", properties: { path }, required: [] } } },
      { type: "function", function: { name: "read_file", description: "Read a UTF-8 text file in the workspace.", parameters: { type: "object", properties: { path }, required: ["path"] } } },
      { type: "function", function: { name: "create_directory", description: "Create a directory inside the opened workspace.", parameters: { type: "object", properties: { path }, required: ["path"] } } },
      { type: "function", function: { name: "write_file", description: "Create or replace a text file inside the opened workspace.", parameters: { type: "object", properties: { path, content: { type: "string", description: "Complete file contents." } }, required: ["path", "content"] } } }
    ];
  }

  private workspaceUri(relativePath: string): vscode.Uri {
    const root = vscode.workspace.workspaceFolders?.[0];
    if (!root || !relativePath || relativePath.includes("..") || relativePath.startsWith("/") || /^[A-Za-z]:/.test(relativePath)) throw new Error("Workspace path must be relative and stay inside the opened workspace.");
    return vscode.Uri.joinPath(root.uri, relativePath.replaceAll("\\", "/"));
  }

  private async createDirectory(relativePath: string): Promise<void> {
    const uri = this.workspaceUri(relativePath);
    await vscode.workspace.fs.createDirectory(uri);
    this.post({ type: "status", text: `Created directory ${vscode.workspace.asRelativePath(uri)}` });
  }

  private async listFiles(relativePath: string): Promise<string[]> {
    const uri = relativePath ? this.workspaceUri(relativePath) : vscode.workspace.workspaceFolders?.[0]?.uri;
    if (!uri) throw new Error("Open a workspace before using repository tools.");
    const entries = await vscode.workspace.fs.readDirectory(uri);
    return entries.map(([name, kind]) => `${kind === vscode.FileType.Directory ? "directory" : "file"}: ${name}`);
  }

  private async readFile(relativePath: string): Promise<string> {
    const uri = this.workspaceUri(relativePath);
    const content = new TextDecoder("utf-8").decode(await vscode.workspace.fs.readFile(uri));
    return content.slice(0, 30000);
  }

  private async writeFile(relativePath: string, content: string): Promise<void> {
    const uri = this.workspaceUri(relativePath);
    await vscode.workspace.fs.writeFile(uri, new TextEncoder().encode(content));
    this.post({ type: "status", text: `Wrote file ${vscode.workspace.asRelativePath(uri)}` });
  }

  private async repositoryKnowledge(): Promise<string> {
    const root = vscode.workspace.workspaceFolders?.[0];
    if (!root) return "";
    const files = await vscode.workspace.findFiles(".ai/**/*.md", "**/node_modules/**", 12);
    const parts: string[] = [];
    for (const file of files) {
      const content = new TextDecoder("utf-8").decode(await vscode.workspace.fs.readFile(file));
      parts.push(`\n--- ${vscode.workspace.asRelativePath(file)} ---\n${content.slice(0, 12000)}`);
    }
    return parts.length ? `\n\nRepository knowledge (curated .ai documentation):${parts.join("\n")}` : "";
  }

  private html(webview: vscode.Webview): string {
    const nonce = String(Date.now());
    return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}'"><style>
    *{box-sizing:border-box}body{margin:0;background:var(--vscode-sideBar-background);color:var(--vscode-foreground);font:13px var(--vscode-font-family);height:100vh;display:flex;flex-direction:column}header{padding:18px;border-bottom:1px solid #ffffff18;display:flex;justify-content:space-between;align-items:center}button{cursor:pointer;border:1px solid #ffffff22;border-radius:8px;background:var(--vscode-button-secondaryBackground);color:var(--vscode-foreground);padding:8px}main{flex:1;overflow:auto;padding:18px}.welcome{padding:40px 8px;color:var(--vscode-descriptionForeground)}h1{font-size:23px;color:var(--vscode-foreground)}.msg{white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.7;margin:14px 0;padding:14px;border-radius:12px;background:#ffffff06}.user{background:#ffffff12}.error{color:#ff9696}footer{padding:16px}textarea{width:100%;background:var(--vscode-input-background);color:var(--vscode-input-foreground);border:1px solid #ffffff25;border-radius:12px;padding:14px;resize:vertical;font:inherit}.actions{display:flex;gap:8px;margin-top:8px}#send{margin-left:auto;background:var(--vscode-button-background);color:var(--vscode-button-foreground)}#status{font-size:11px;min-height:22px;color:var(--vscode-descriptionForeground)}
    </style></head><body><header><strong>Agent Harness</strong><button id="clear">New chat</button></header><main id="messages"><div class="welcome"><h1>What are we building?</h1>Refactor a repository, develop a feature, or add a skill.<br><br>Local models. Your workspace.</div></main><footer><div id="status"></div><textarea id="input" rows="3" placeholder="Message your coding assistant…"></textarea><div class="actions"><button id="skill">＋ Skill</button><button id="settings">Model / settings</button><button id="send">Send ↑</button></div></footer><script nonce="${nonce}">
    const vscode=acquireVsCodeApi(),messages=document.getElementById('messages'),input=document.getElementById('input'),send=document.getElementById('send');let current,busy=false;
    function add(role,text){document.querySelector('.welcome')?.remove();const el=document.createElement('div');el.className='msg '+role;el.textContent=text;messages.append(el);messages.scrollTop=messages.scrollHeight;return el}
    send.onclick=()=>{if(busy||!input.value.trim())return;busy=true;send.disabled=true;vscode.postMessage({type:'chat',text:input.value.trim()});input.value=''};
    input.onkeydown=e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send.click()}};
    for(const type of ['skill','settings'])document.getElementById(type).onclick=()=>vscode.postMessage({type});
    document.getElementById('clear').onclick=()=>{if(busy)return;messages.replaceChildren();current=null;vscode.postMessage({type:'clear'})};
    window.addEventListener('message',({data:m})=>{if(m.type==='restore'){messages.replaceChildren();m.messages.forEach(x=>add(x.role,x.content))}if(m.type==='user')add('user',m.text);if(m.type==='assistantDelta'){if(!current)current=add('assistant','');current.textContent+=m.text}if(m.type==='error')add('error',m.text);if(m.type==='status'){document.getElementById('status').textContent=m.text;if(!m.text){current=null;busy=false;send.disabled=false}}messages.scrollTop=messages.scrollHeight});vscode.postMessage({type:'ready'});
    </script></body></html>`;
  }
}
