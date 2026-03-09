import { useEffect, useState } from 'react';
import type { PluginPersistenceService } from '@shenbi/editor-plugin-api';

const FALLBACK_PLANNER_MODELS = ['GLM-4.7', 'GLM-4.6', 'GLM-5'];
const FALLBACK_BLOCK_MODELS = ['GLM-4.6', 'GLM-4.7', 'GLM-5'];
const DEFAULT_PLANNER_MODEL = FALLBACK_PLANNER_MODELS[0]!;
const DEFAULT_BLOCK_MODEL = FALLBACK_BLOCK_MODELS[0]!;
const PERSISTENCE_NAMESPACE = 'ai-chat';
const PERSISTENCE_KEY = 'model-selection';

interface ModelInfo {
    id: string;
    name: string;
    [key: string]: unknown;
}

export function useModels(
    defaultPlannerModel?: string,
    defaultBlockModel?: string,
    persistence?: PluginPersistenceService,
) {
    const [plannerModel, setPlannerModel] = useState<string>(defaultPlannerModel ?? DEFAULT_PLANNER_MODEL);
    const [blockModel, setBlockModel] = useState<string>(defaultBlockModel ?? DEFAULT_BLOCK_MODEL);
    const [availableModels, setAvailableModels] = useState<string[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectionHydrated, setSelectionHydrated] = useState(!persistence);

    useEffect(() => {
        let cancelled = false;
        if (!persistence) {
            setSelectionHydrated(true);
            return () => {
                cancelled = true;
            };
        }

        void persistence
            .getJSON<{
                plannerModel?: string;
                blockModel?: string;
            }>(PERSISTENCE_NAMESPACE, PERSISTENCE_KEY)
            .then((storedSelection) => {
                if (cancelled || !storedSelection) {
                    return;
                }
                if (storedSelection.plannerModel) {
                    setPlannerModel(storedSelection.plannerModel);
                }
                if (storedSelection.blockModel) {
                    setBlockModel(storedSelection.blockModel);
                }
            })
            .catch(() => undefined)
            .finally(() => {
                if (!cancelled) {
                    setSelectionHydrated(true);
                }
            });

        return () => {
            cancelled = true;
        };
    }, [persistence]);

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

    useEffect(() => {
        if (!persistence || !selectionHydrated) {
            return;
        }

        void persistence
            .setJSON(PERSISTENCE_NAMESPACE, PERSISTENCE_KEY, { plannerModel, blockModel })
            .catch(() => undefined);
    }, [blockModel, persistence, plannerModel, selectionHydrated]);

    useEffect(() => {
        if (availableModels.length === 0) {
            return;
        }

        if (!availableModels.includes(plannerModel)) {
            setPlannerModel(availableModels[0] ?? DEFAULT_PLANNER_MODEL);
        }

        if (!availableModels.includes(blockModel)) {
            setBlockModel(availableModels[0] ?? DEFAULT_BLOCK_MODEL);
        }
    }, [availableModels, blockModel, plannerModel]);

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
