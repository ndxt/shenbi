import type { AgentEvent, AgentIntent, AgentRuntimeContext, AgentRuntimeDeps, RunMetadata, RunRequest } from '../types';

export type OrchestratorFunction = (
  request: RunRequest,
  context: AgentRuntimeContext,
  deps: AgentRuntimeDeps,
  metadata: RunMetadata,
) => AsyncGenerator<AgentEvent>;

export interface OrchestratorRegistration {
  id: string;
  intents: AgentIntent[];
  canHandle?(context: AgentRuntimeContext, deps: AgentRuntimeDeps): boolean;
  orchestrate: OrchestratorFunction;
}

export interface OrchestratorRegistry {
  register(registration: OrchestratorRegistration): void;
  resolve(intent: AgentIntent, context: AgentRuntimeContext, deps: AgentRuntimeDeps): OrchestratorFunction | undefined;
}

class InMemoryOrchestratorRegistry implements OrchestratorRegistry {
  private readonly registrations: OrchestratorRegistration[] = [];

  register(registration: OrchestratorRegistration): void {
    this.registrations.push(registration);
  }

  resolve(intent: AgentIntent, context: AgentRuntimeContext, deps: AgentRuntimeDeps): OrchestratorFunction | undefined {
    return this.registrations.find((registration) =>
      registration.intents.includes(intent)
      && (registration.canHandle?.(context, deps) ?? true))?.orchestrate;
  }
}

export function createOrchestratorRegistry(): OrchestratorRegistry {
  return new InMemoryOrchestratorRegistry();
}
