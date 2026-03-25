import { createStep, createWorkflow } from '@mastra/core/workflows';
import type {
  AgentEvent,
  AgentOperation,
  RunMetadata,
  RunRequest,
} from '@shenbi/ai-contracts';
import type {
  AgentRuntimeContext,
  AgentRuntimeDeps,
  PagePlan,
} from '@shenbi/ai-agents';
import {
  modifyOrchestrator,
  pageBuilderOrchestrator,
} from '@shenbi/ai-agents';
import type { PageSchema } from '@shenbi/schema';
import { z } from 'zod';
import { WorkflowEventAdapter, type AgentEventSink } from './event-adapter';

const runRequestSchema = z.custom<RunRequest>();
const runtimeContextSchema = z.custom<AgentRuntimeContext>();
const metadataSchema = z.custom<RunMetadata>();
const pageSchemaSchema = z.custom<PageSchema>();
const pagePlanSchema = z.custom<PagePlan>();
const operationSchema = z.custom<AgentOperation>();
const agentEventSchema = z.custom<AgentEvent>();

export interface PageCreateWorkflowInput {
  request: RunRequest;
  context: AgentRuntimeContext;
  metadata: RunMetadata;
}

export interface PageCreateWorkflowOutput {
  events: AgentEvent[];
  assistantText: string;
  schema: PageSchema;
  blockIds: string[];
  plan?: PagePlan | undefined;
}

export interface PageModifyWorkflowInput {
  request: RunRequest;
  context: AgentRuntimeContext;
  metadata: RunMetadata;
}

export interface PageModifyWorkflowOutput {
  events: AgentEvent[];
  assistantText: string;
  operations: AgentOperation[];
}

const pageCreateInputSchema = z.object({
  request: runRequestSchema,
  context: runtimeContextSchema,
  metadata: metadataSchema,
});

const pageCreateOutputSchema = z.object({
  events: z.array(agentEventSchema),
  assistantText: z.string(),
  schema: pageSchemaSchema,
  blockIds: z.array(z.string()),
  plan: pagePlanSchema.optional(),
});

const pageModifyInputSchema = z.object({
  request: runRequestSchema,
  context: runtimeContextSchema,
  metadata: metadataSchema,
});

const pageModifyOutputSchema = z.object({
  events: z.array(agentEventSchema),
  assistantText: z.string(),
  operations: z.array(operationSchema),
});

function collectPageCreateOutput(events: AgentEvent[]): PageCreateWorkflowOutput {
  const assistantText = events
    .filter((event): event is Extract<AgentEvent, { type: 'message:delta' }> => event.type === 'message:delta')
    .map((event) => event.data.text)
    .join('');
  const schemaEvent = [...events]
    .reverse()
    .find((event): event is Extract<AgentEvent, { type: 'schema:done' }> => event.type === 'schema:done');

  if (!schemaEvent) {
    throw new Error('Mastra page-create workflow completed without schema:done event');
  }

  const planEvent = events.find((event): event is Extract<AgentEvent, { type: 'plan' }> => event.type === 'plan');
  const blockIds = events
    .filter((event): event is Extract<AgentEvent, { type: 'schema:block' }> => event.type === 'schema:block')
    .map((event) => event.data.blockId);

  return {
    events,
    assistantText,
    schema: schemaEvent.data.schema,
    blockIds,
    ...(planEvent ? { plan: planEvent.data } : {}),
  };
}

function collectPageModifyOutput(events: AgentEvent[]): PageModifyWorkflowOutput {
  const assistantText = events
    .filter((event): event is Extract<AgentEvent, { type: 'message:delta' }> => event.type === 'message:delta')
    .map((event) => event.data.text)
    .join('');
  const operations = events
    .filter((event): event is Extract<AgentEvent, { type: 'modify:op' }> => event.type === 'modify:op')
    .map((event) => event.data.operation);

  return {
    events,
    assistantText,
    operations,
  };
}

export function createPageCreateWorkflow(deps: AgentRuntimeDeps, emit: AgentEventSink) {
  const executePageCreate = createStep({
    id: 'page-create-execute',
    inputSchema: pageCreateInputSchema,
    outputSchema: pageCreateOutputSchema,
    execute: async ({ inputData }) => {
      const adapter = new WorkflowEventAdapter(emit);
      for await (const event of pageBuilderOrchestrator(
        inputData.request,
        inputData.context,
        deps,
        inputData.metadata,
      )) {
        adapter.emit(event);
      }
      return collectPageCreateOutput(adapter.snapshot());
    },
  });

  return createWorkflow({
    id: 'page-create-workflow',
    inputSchema: pageCreateInputSchema,
    outputSchema: pageCreateOutputSchema,
  }).then(executePageCreate).commit();
}

export function createPageModifyWorkflow(deps: AgentRuntimeDeps, emit: AgentEventSink) {
  const executePageModify = createStep({
    id: 'page-modify-execute',
    inputSchema: pageModifyInputSchema,
    outputSchema: pageModifyOutputSchema,
    execute: async ({ inputData }) => {
      const adapter = new WorkflowEventAdapter(emit);
      for await (const event of modifyOrchestrator(
        inputData.request,
        inputData.context,
        deps,
        inputData.metadata,
      )) {
        adapter.emit(event);
      }
      return collectPageModifyOutput(adapter.snapshot());
    },
  });

  return createWorkflow({
    id: 'page-modify-workflow',
    inputSchema: pageModifyInputSchema,
    outputSchema: pageModifyOutputSchema,
  }).then(executePageModify).commit();
}
