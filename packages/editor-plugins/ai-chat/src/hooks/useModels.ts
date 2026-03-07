import { useState } from 'react';

const PLANNER_MODELS = ['gpt-4-turbo', 'claude-3-opus', 'gemini-1.5-pro'] as const;
const BLOCK_MODELS = ['gpt-3.5-turbo', 'claude-3-haiku', 'gemini-1.5-flash'] as const;

export function useModels(defaultPlannerModel?: string, defaultBlockModel?: string) {
    const [plannerModel, setPlannerModel] = useState(defaultPlannerModel ?? PLANNER_MODELS[0]);
    const [blockModel, setBlockModel] = useState(defaultBlockModel ?? BLOCK_MODELS[0]);

    return {
        plannerModels: PLANNER_MODELS as unknown as string[],
        plannerModel,
        setPlannerModel,
        blockModels: BLOCK_MODELS as unknown as string[],
        blockModel,
        setBlockModel
    };
}

