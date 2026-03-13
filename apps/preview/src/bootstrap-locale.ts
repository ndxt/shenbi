import {
  LocalWorkspacePersistenceAdapter,
  WORKSPACE_PREFERENCES_NAMESPACE,
  WORKSPACE_WORKBENCH_KEY,
  createWorkspacePersistenceService,
  type WorkspacePersistenceAdapter,
} from '@shenbi/editor-ui';
import { changeLanguage, detectBrowserLocale, isSupportedLocale } from '@shenbi/i18n';

interface StoredWorkbenchPreferences {
  locale?: string;
}

export async function bootstrapWorkspaceLocale(
  workspaceId: string,
  adapter: WorkspacePersistenceAdapter = new LocalWorkspacePersistenceAdapter(),
): Promise<void> {
  const persistence = createWorkspacePersistenceService(workspaceId, adapter);
  const storedPreferences = await persistence.getJSON<StoredWorkbenchPreferences>(
    WORKSPACE_PREFERENCES_NAMESPACE,
    WORKSPACE_WORKBENCH_KEY,
  );
  const nextLocale = isSupportedLocale(storedPreferences?.locale)
    ? storedPreferences.locale
    : detectBrowserLocale();
  await changeLanguage(nextLocale);
}
