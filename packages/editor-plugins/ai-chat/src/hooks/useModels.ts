import { useState, useEffect } from 'react';

/** Fallback model lists used while the API response is loading or if the fetch fails. */
const FALLBACK_PLANNER_MODELS = ['GLM-4.7', 'GLM-4.6', 'GLM-5'];
const FALLBACK_BLOCK_MODELS = ['GLM-4.6', 'GLM-4.7', 'GLM-5'];

interface ModelInfo {
    id: string;
    name: string;
    [key: string]: unknown;
}

export function useModels(defaultPlannerModel?: string, defaultBlockModel?: string) {
    const [plannerModel, setPlannerModel] = useState(defaultPlannerModel ?? FALLBACK_PLANNER_MODELS[0]);
    const [blockModel, setBlockModel] = useState(defaultBlockModel ?? FALLBACK_BLOCK_MODELS[0]);
    const [availableModels, setAvailableModels] = useState<string[]>([]);

    useEffect(() => {
        let cancelled = false;

        fetch('/api/ai/models')
            .then((res) => {
                if (!res.ok) {
                    throw new Error(`Failed to fetch models: ${res.status}`);
                }
                return res.json() as Promise<{ success: boolean; data: ModelInfo[] }>;
            })
            .then((body) => {
                if (cancelled) return;
                if (body.success && Array.isArray(body.data)) {
                    const ids = body.data.map((m) => m.id);
                    if (ids.length > 0) {
                        setAvailableModels(ids);
                    }
                }
            })
            .catch(() => {
                // Use fallback models on fetch failure — no silent crash.
            });

        return () => {
            cancelled = true;
        };
    }, []);

    const models = availableModels.length > 0 ? availableModels : FALLBACK_PLANNER_MODELS;

    return {
        plannerModels: models,
        plannerModel,
        setPlannerModel,
        blockModels: models,
        blockModel,
        setBlockModel,
    };
}
