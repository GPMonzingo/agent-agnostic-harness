import type { RegisteredModel } from "./types.js";
export class ModelRegistry {
  private readonly models = new Map<string, RegisteredModel>();
  constructor(models: RegisteredModel[] = []) { models.forEach(model => this.register(model)); }
  register(model: RegisteredModel): void { this.models.set(model.id, model); }
  getModels(): RegisteredModel[] { return [...this.models.values()]; }
  getModel(id: string): RegisteredModel { const model = this.models.get(id); if (!model) throw new Error(`Model not registered: ${id}`); return model; }
}
