import { useEffect, useMemo, useState } from 'react';
import type { PluginPersistenceService } from '@shenbi/editor-plugin-api';

const FALLBACK_PLANNER_MODELS = ['openai-compatible::GLM-4.7', 'openai-compatible::GLM-4.6', 'openai-compatible::GLM-5'];
const FALLBACK_BLOCK_MODELS = ['openai-compatible::GLM-4.6', 'openai-compatible::GLM-4.7', 'openai-compatible::GLM-5'];
const DEFAULT_PLANNER_MODEL = FALLBACK_PLANNER_MODELS[0]!;
const DEFAULT_BLOCK_MODEL = FALLBACK_BLOCK_MODELS[0]!;
const PERSISTENCE_NAMESPACE = 'ai-chat';
const PERSISTENCE_KEY = 'model-selection';

interface ModelInfo {
    id: string;
    name: string;
    provider?: string;
    [key: string]: unknown;
}

export interface ModelOption {
    value: string;
    label: string;
    provider: string;
}

export interface ModelGroup {
    provider: string;
    label: string;
    options: ModelOption[];
}

function humanizeProviderLabel(provider: string): string {
    return provider
        .split(/[-_]/g)
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');
}

function flattenModelGroups(groups: ModelGroup[]): ModelOption[] {
    return groups.flatMap((group) => group.options);
}

function normalizeSelectionValue(value: string | undefined, options: ModelOption[], fallback: string): string {
    if (!value) {
        return fallback;
    }
    if (options.some((option) => option.value === value)) {
        return value;
    }
    const byLabel = options.find((option) => option.label === value);
    if (byLabel) {
        return byLabel.value;
    }
    return fallback;
}

export function useModels(
    defaultPlannerModel?: string,
    defaultBlockModel?: string,
    persistence?: PluginPersistenceService,
) {
    const [plannerModel, setPlannerModel] = useState<string>(defaultPlannerModel ?? DEFAULT_PLANNER_MODEL);
    const [blockModel, setBlockModel] = useState<string>(defaultBlockModel ?? DEFAULT_BLOCK_MODEL);
    const [availableModelGroups, setAvailableModelGroups] = useState<ModelGroup[]>([]);
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
                    const groupsMap = new Map<string, ModelOption[]>();
                    body.data.forEach((model) => {
                        const provider = typeof model.provider === 'string' && model.provider
                            ? model.provider
                            : 'default';
                        const options = groupsMap.get(provider) ?? [];
                        options.push({
                            value: model.id,
                            label: model.name,
                            provider,
                        });
                        groupsMap.set(provider, options);
                    });
                    const groups = Array.from(groupsMap.entries()).map(([provider, options]) => ({
                        provider,
                        label: humanizeProviderLabel(provider),
                        options,
                    }));
                    if (groups.length === 0 || flattenModelGroups(groups).length === 0) {
                        throw new Error('Model list is empty');
                    }
                    setAvailableModelGroups(groups);
                    return;
                }
                throw new Error('Model list response is invalid');
            })
            .catch((err: unknown) => {
                if (cancelled) return;
                setAvailableModelGroups([]);
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

    const flatOptions = useMemo(() => flattenModelGroups(availableModelGroups), [availableModelGroups]);

    useEffect(() => {
        if (flatOptions.length === 0) {
            return;
        }

        const fallbackPlanner = flatOptions[0]?.value ?? DEFAULT_PLANNER_MODEL;
        const fallbackBlock = flatOptions[0]?.value ?? DEFAULT_BLOCK_MODEL;
        const nextPlanner = normalizeSelectionValue(plannerModel, flatOptions, fallbackPlanner);
        const nextBlock = normalizeSelectionValue(blockModel, flatOptions, fallbackBlock);

        if (nextPlanner !== plannerModel) {
            setPlannerModel(nextPlanner);
        }

        if (nextBlock !== blockModel) {
            setBlockModel(nextBlock);
        }
    }, [blockModel, flatOptions, plannerModel]);

    const modelGroups = availableModelGroups.length > 0 ? availableModelGroups : [];

    return {
        plannerModels: modelGroups,
        plannerModel,
        setPlannerModel,
        blockModels: modelGroups,
        blockModel,
        setBlockModel,
        isLoading,
        error,
    };
}
