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
  private ollamaStartup?: Promise<void>;

  constructor(private readonly context: vscode.ExtensionContext) {
    this.messages = context.globalState.get<ChatMessage[]>("chatMessages", []);
  }

  resolveWebviewView(view: vscode.WebviewView): void {
    this.view = view;
    view.webview.options = { enableScripts: true };
    view.webview.html = this.html(view.webview);
    this.post({ type: "restore", messages: this.messages.map(({ role, content }) => ({ role, content })) });
    view.webview.onDidReceiveMessage(async (message: { type: string; text?: string }) => {
      if (message.type !== "chat" || !message.text?.trim()) return;
      await this.chat(message.text.trim());
    });
  }

  private async chat(text: string): Promise<void> {
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
      let response = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ model, messages: this.messages, stream: true, tools: this.workspaceTools() }) });
      // Some local models reject Ollama's tool-calling payload with HTTP 400.
      // Retry as a normal chat so the assistant remains usable even when tools
      // are not supported by the selected model.
      if (response.status === 400) {
        response = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ model, messages: this.messages, stream: true }) });
      }
      if (!response.ok) {
        const detail = await response.text();
        throw new Error(`Ollama returned HTTP ${response.status}${detail ? `: ${detail}` : ""}`);
      }
      if (!response.body) throw new Error("Ollama returned no response stream.");
      this.post({ type: "status", text: "Model is responding…" });
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let answer = "";
      const toolCalls: Array<{ id?: string; function?: { name?: string; arguments?: unknown } }> = [];
      while (true) {
        const { value, done } = await reader.read();
        buffer += decoder.decode(value, { stream: !done });
        for (const line of buffer.split("\n").slice(0, -1)) {
          if (!line.trim()) continue;
          const chunk = JSON.parse(line) as { message?: { content?: string }; done?: boolean };
          const message = chunk.message as ({ content?: string; tool_calls?: typeof toolCalls } | undefined);
          if (message?.tool_calls) toolCalls.push(...message.tool_calls);
          const token = message?.content ?? "";
          if (token) { answer += token; this.post({ type: "assistantDelta", text: token }); }
          if (chunk.done) this.post({ type: "status", text: "Response complete." });
        }
        buffer = buffer.split("\n").at(-1) ?? "";
        if (done) break;
      }
      if (!answer) answer = "Ollama returned an empty response.";
      for (const call of toolCalls) {
        const name = call.function?.name;
        const args = typeof call.function?.arguments === "string" ? JSON.parse(call.function.arguments) : call.function?.arguments ?? {};
        if (name === "list_files") {
          const result = await this.listFiles(String((args as { path?: string }).path ?? ""));
          this.post({ type: "status", text: `Listed ${result.length} file(s)` });
        } else if (name === "read_file") {
          const result = await this.readFile(String((args as { path?: string }).path ?? ""));
          this.post({ type: "status", text: `Read ${String((args as { path?: string }).path ?? "")}` });
          void result;
        } else if (name === "create_directory") {
          await this.createDirectory(String((args as { path?: string }).path ?? ""));
        } else if (name === "write_file") {
          const values = args as { path?: string; content?: string };
          await this.writeFile(String(values.path ?? ""), String(values.content ?? ""));
        }
      }
      this.messages.push({ role: "assistant", content: answer });
      await this.context.globalState.update("chatMessages", this.messages);
    } catch (error) {
      this.post({ type: "error", text: `Ollama request failed. Make sure the configured model is available.\n\n${String(error)}` });
    } finally { this.post({ type: "status", text: "" }); }
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
      terminal.sendText("npm run ollama:deepseek", true);
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
    const files = await vscode.workspace.findFiles(".ai/*.md", "**/node_modules/**", 12);
    const parts: string[] = [];
    for (const file of files) {
      const content = new TextDecoder("utf-8").decode(await vscode.workspace.fs.readFile(file));
      parts.push(`\n--- ${vscode.workspace.asRelativePath(file)} ---\n${content.slice(0, 12000)}`);
    }
    return parts.length ? `\n\nRepository knowledge (curated .ai documentation):${parts.join("\n")}` : "";
  }

  private html(webview: vscode.Webview): string {
    const nonce = String(Date.now());
    return `<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}'"><style>
      body{font-family:var(--vscode-font-family);color:var(--vscode-foreground);padding:10px}.messages{display:flex;flex-direction:column;gap:8px;margin-bottom:10px}.msg{white-space:pre-wrap;padding:7px;border-radius:4px;background:var(--vscode-textBlockQuote-background)}.user{background:var(--vscode-button-background)}.error{background:var(--vscode-inputValidation-errorBackground)}#status{min-height:1.4em;color:var(--vscode-descriptionForeground);font-style:italic}textarea{width:100%;box-sizing:border-box;resize:vertical;background:var(--vscode-input-background);color:var(--vscode-input-foreground);border:1px solid var(--vscode-input-border);padding:7px}button{margin-top:6px;width:100%;padding:6px}
    </style></head><body><div id="messages" class="messages"></div><div id="status"></div><textarea id="input" rows="4" placeholder="Ask about this workspace..."></textarea><button id="send">Send</button><script nonce="${nonce}">
      const vscode=acquireVsCodeApi(), messages=document.getElementById('messages'), input=document.getElementById('input'); let current; function add(c,t){if(!t)return;const d=document.createElement('div');d.className='msg '+c;d.textContent=t;messages.appendChild(d);messages.scrollTop=messages.scrollHeight;return d} function save(){vscode.setState({html:messages.innerHTML,input:input.value})} document.getElementById('send').onclick=()=>{const t=input.value.trim();if(t){add('user',t);vscode.postMessage({type:'chat',text:t});input.value='';save()}};input.addEventListener('input',save);input.addEventListener('keydown',e=>{if(e.key==='Enter'&&(e.ctrlKey||e.metaKey)){e.preventDefault();document.getElementById('send').click()}});window.addEventListener('message',e=>{const m=e.data;if(m.type==='restore'){messages.innerHTML='';m.messages.forEach(x=>add(x.role==='user'?'user':'assistant',x.content));return}if(m.type==='assistantDelta'){if(!current)current=add('assistant','');current.textContent+=m.text;messages.scrollTop=messages.scrollHeight;save();return}if(m.type==='error')add('error',m.text);if(m.type==='status'){document.getElementById('status').textContent=m.text;if(!m.text)current=undefined}save()});const prior=vscode.getState();if(prior){messages.innerHTML=prior.html||'';input.value=prior.input||''}
    </script></body></html>`;
  }
}
