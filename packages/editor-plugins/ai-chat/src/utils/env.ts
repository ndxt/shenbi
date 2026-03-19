type ImportMetaWithOptionalEnv = ImportMeta & {
    env?: {
        PROD?: boolean;
    };
};

export function isProductionEnvironment(): boolean {
    return (import.meta as ImportMetaWithOptionalEnv).env?.PROD === true;
}
