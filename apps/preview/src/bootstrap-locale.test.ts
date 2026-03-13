import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { changeLanguage, i18n } from '@shenbi/i18n';
import {
  LocalWorkspacePersistenceAdapter,
  WORKSPACE_PREFERENCES_NAMESPACE,
  WORKSPACE_WORKBENCH_KEY,
} from '@shenbi/editor-ui';
import { bootstrapWorkspaceLocale } from './bootstrap-locale';

describe('bootstrapWorkspaceLocale', () => {
  beforeEach(async () => {
    window.localStorage.clear();
    await changeLanguage('zh-CN');
  });

  afterEach(async () => {
    await changeLanguage('zh-CN');
  });

  it('会在首屏渲染前恢复 workspace 语言偏好', async () => {
    const adapter = new LocalWorkspacePersistenceAdapter(window.localStorage);
    window.localStorage.setItem(
      'shenbi:workspace:preview-test:preferences:workbench',
      JSON.stringify({
        locale: 'en-US',
      }),
    );

    await bootstrapWorkspaceLocale('preview-test', adapter);

    expect(i18n.language).toBe('en-US');
  });

  it('会从正式的 workspace 偏好 key 读取语言配置', async () => {
    const adapter = new LocalWorkspacePersistenceAdapter(window.localStorage);
    await adapter.setJSON('preview-test', WORKSPACE_PREFERENCES_NAMESPACE, WORKSPACE_WORKBENCH_KEY, {
      locale: 'en-US',
    });

    await bootstrapWorkspaceLocale('preview-test', adapter);

    expect(i18n.language).toBe('en-US');
  });
});
