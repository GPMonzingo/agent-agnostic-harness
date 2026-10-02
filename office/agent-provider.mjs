import {EventEmitter} from 'node:events';

/** Stateful agent providers emit `change` and expose a public snapshot.
 * Kept separate from ModelProvider.generate: agents own threads, turns and approvals.
 */
export class AgentProvider extends EventEmitter {
  snapshot() { throw new Error('snapshot not implemented'); }
  async connect() { throw new Error('connect not implemented'); }
  async listThreads() { throw new Error('listThreads not implemented'); }
  async startThread() { throw new Error('startThread not implemented'); }
  async resumeThread() { throw new Error('resumeThread not implemented'); }
  async send() { throw new Error('send not implemented'); }
  async interrupt() { throw new Error('interrupt not implemented'); }
  respond() { throw new Error('respond not implemented'); }
}

export class AgentProviderRegistry {
  providers = new Map();
  register(provider) { this.providers.set(provider.name, provider); return provider; }
  get(name) {
    const provider = this.providers.get(name);
    if (!provider) throw new Error(`Unknown agent provider: ${name}`);
    return provider;
  }
}
