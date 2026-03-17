/**
 * POST /api/ai/classify-route — 轻量级路由分类
 *
 * 让大模型判断用户请求应该走单页面（legacy）还是多页面（Agent Loop）路径。
 * 请求体为 ClassifyRouteRequest，响应为 ClassifyRouteResponse。
 */
import { Hono } from 'hono';
import { handleError } from '../middleware/error-handler.ts';
import { logRequest, logger } from '../adapters/logger.ts';
import type { ClassifyRouteRequest, ClassifyRouteResponse } from '@shenbi/ai-contracts';
import type { ClassifyIntentInput, IntentClassification } from '@shenbi/ai-agents';
import { classifyIntentWithModel } from '../runtime/classify-intent.ts';
import { prepareRunRequest } from '../runtime/request-attachments.ts';

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function validateClassifyRouteRequest(body: unknown): ClassifyRouteRequest {
  if (!isRecord(body)) {
    throw new Error('Request body must be a JSON object');
  }
  const prompt = body['prompt'];
  if (typeof prompt !== 'string' || !prompt.trim()) {
    throw new Error('Missing required field: prompt');
  }
  const context = body['context'];
  if (!isRecord(context) || typeof context['schemaSummary'] !== 'string') {
    throw new Error('Missing required field: context.schemaSummary');
  }
  return body as unknown as ClassifyRouteRequest;
}

export function createClassifyRouteRoute(): Hono {
  const app = new Hono();

  app.post('/', async (c) => {
    const requestId = (c.get('requestId' as never) as string | undefined) ?? 'unknown';
    const start = Date.now();

    let req: ClassifyRouteRequest;
    try {
      const body = await c.req.json().catch(() => null);
      req = validateClassifyRouteRequest(body);
    } catch (error) {
      return handleError(error, c);
    }

    try {
      // Build a synthetic RunRequest for the classify-intent pipeline
      const syntheticRunRequest = {
        prompt: req.prompt,
        ...(req.attachments ? { attachments: req.attachments } : {}),
        ...(req.plannerModel ? { plannerModel: req.plannerModel } : {}),
        ...(req.thinking ? { thinking: req.thinking } : {}),
        context: {
          schemaSummary: req.context.schemaSummary,
          componentSummary: '',
        },
      };

      // Prepare attachments (extract document text etc.)
      const preparedRequest = await prepareRunRequest(syntheticRunRequest);

      const classifyInput: ClassifyIntentInput = {
        request: preparedRequest,
        context: {
          prompt: preparedRequest.prompt,
          document: {
            exists: req.context.schemaSummary !== 'pageId=empty; pageName=empty; nodeCount=0',
            summary: req.context.schemaSummary,
          },
          componentSummary: '',
          conversation: {
            history: [],
            turnCount: 0,
          },
          lastBlockIds: [],
        },
      };

      const result: IntentClassification = await classifyIntentWithModel(classifyInput);

      // preparedRequest.prompt already contains extracted document text (from prepareRunRequest)
      // Only include it when it differs from the original prompt (i.e. when docs were present)
      const preparedPrompt = preparedRequest.prompt !== req.prompt
        ? preparedRequest.prompt
        : undefined;

      const response: ClassifyRouteResponse = {
        scope: result.scope ?? 'single-page',
        intent: result.intent,
        confidence: result.confidence,
        ...(preparedPrompt ? { preparedPrompt } : {}),
      };

      logRequest({
        requestId,
        durationMs: Date.now() - start,
        success: true,
        route: 'POST /api/ai/classify-route',
      });

      return c.json({ success: true, data: response });
    } catch (error) {
      logger.error('ai.classify-route.error', {
        requestId,
        error: error instanceof Error ? error.message : String(error),
      });

      logRequest({
        requestId,
        durationMs: Date.now() - start,
        success: false,
        route: 'POST /api/ai/classify-route',
      });

      return handleError(error, c);
    }
  });

  return app;
}
