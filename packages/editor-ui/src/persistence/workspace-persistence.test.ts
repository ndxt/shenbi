import { beforeEach, describe, expect, it } from 'vitest';
import {
  LocalWorkspacePersistenceAdapter,
  WORKSPACE_PREFERENCES_NAMESPACE,
  WORKSPACE_WORKBENCH_KEY,
} from './workspace-persistence';

describe('workspace persistence', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('会把旧的 shenbi-locale 迁移到 workspace 偏好配置', async () => {
    const adapter = new LocalWorkspacePersistenceAdapter(window.localStorage);
    window.localStorage.setItem('shenbi-locale', 'en-US');

    const preferences = await adapter.getJSON<{ locale?: string }>(
      'workspace-a',
      WORKSPACE_PREFERENCES_NAMESPACE,
      WORKSPACE_WORKBENCH_KEY,
    );

    expect(preferences).toEqual({ locale: 'en-US' });
    expect(window.localStorage.getItem('shenbi-locale')).toBeNull();
    expect(
      window.localStorage.getItem('shenbi:workspace:workspace-a:preferences:workbench'),
    ).toBe(JSON.stringify({ locale: 'en-US' }));
  });
});
