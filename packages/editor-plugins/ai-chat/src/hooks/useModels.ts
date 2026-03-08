import { useState, useEffect } from 'react';

const FALLBACK_PLANNER_MODELS = ['GLM-4.7', 'GLM-4.6', 'GLM-5'];
const FALLBACK_BLOCK_MODELS = ['GLM-4.6', 'GLM-4.7', 'GLM-5'];
const DEFAULT_PLANNER_MODEL = FALLBACK_PLANNER_MODELS[0]!;
const DEFAULT_BLOCK_MODEL = FALLBACK_BLOCK_MODELS[0]!;

interface ModelInfo {
    id: string;
    name: string;
    [key: string]: unknown;
}

export function useModels(defaultPlannerModel?: string, defaultBlockModel?: string) {
    const [plannerModel, setPlannerModel] = useState<string>(defaultPlannerModel ?? DEFAULT_PLANNER_MODEL);
    const [blockModel, setBlockModel] = useState<string>(defaultBlockModel ?? DEFAULT_BLOCK_MODEL);
    const [availableModels, setAvailableModels] = useState<string[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        setIsLoading(true);
        setError(null);

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
                    if (ids.length === 0) {
                        throw new Error('Model list is empty');
                    }
                    setAvailableModels(ids);
                    return;
                }
                throw new Error('Model list response is invalid');
            })
            .catch((err: unknown) => {
                if (cancelled) return;
                setAvailableModels([]);
                setError(err instanceof Error ? err.message : 'Failed to load models');
            })
            .finally(() => {
                if (!cancelled) {
                    setIsLoading(false);
                }
            });

        return () => {
            cancelled = true;
        };
    }, []);

    const models = availableModels.length > 0 ? availableModels : [];

    return {
        plannerModels: models,
        plannerModel,
        setPlannerModel,
        blockModels: models,
        blockModel,
        setBlockModel,
        isLoading,
        error,
    };
}
