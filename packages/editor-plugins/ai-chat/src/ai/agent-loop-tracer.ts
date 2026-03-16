import type { ReActStep } from './api-types';

export class AgentLoopTracer {
  private readonly startedAt = Date.now();
  private readonly steps: ReActStep[] = [];

  addStep(step: Omit<ReActStep, 'stepIndex' | 'timestamp'>): ReActStep {
    const nextStep: ReActStep = {
      stepIndex: this.steps.length,
      timestamp: new Date().toISOString(),
      ...step,
    };
    this.steps.push(nextStep);
    return nextStep;
  }

  updateLastObservation(observation: string, toolDurationMs?: number): void {
    const last = this.steps[this.steps.length - 1];
    if (!last) {
      return;
    }
    last.observation = observation;
    if (toolDurationMs !== undefined) {
      last.toolDurationMs = toolDurationMs;
    }
  }

  updateLastError(error: string): void {
    const last = this.steps[this.steps.length - 1];
    if (!last) {
      return;
    }
    last.error = error;
  }

  snapshot(): ReActStep[] {
    return this.steps.map((step) => ({ ...step }));
  }

  getTotalDurationMs(): number {
    return Date.now() - this.startedAt;
  }
}
