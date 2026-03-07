import { useState } from 'react';

export function useModels(defaultPlannerModel?: string, defaultBlockModel?: string) {
    const plannerModels = ['gpt-4-turbo', 'claude-3-opus', 'gemini-1.5-pro'];
    const blockModels = ['gpt-3.5-turbo', 'claude-3-haiku', 'gemini-1.5-flash'];

    const [plannerModel, setPlannerModel] = useState(defaultPlannerModel ?? plannerModels[0]!);
    const [blockModel, setBlockModel] = useState(defaultBlockModel ?? blockModels[0]!);

    return {
        plannerModels,
        plannerModel,
        setPlannerModel,
        blockModels,
        blockModel,
        setBlockModel
    };
}
