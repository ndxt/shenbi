import { useState } from 'react';

const PLANNER_MODELS = ['GLM-4.7', 'GLM-4.6', 'GLM-5'] as const;
const BLOCK_MODELS = ['GLM-4.6', 'GLM-4.7', 'GLM-5'] as const;

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

