import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import 'antd/dist/reset.css';
import { useAntdLocale } from '@shenbi/i18n';
import { App } from './App';
import { bootstrapWorkspaceLocale } from './bootstrap-locale';
import { PREVIEW_WORKSPACE_ID } from './constants';

const container = document.getElementById('root');

if (!container) {
  throw new Error('Root element not found');
}

const rootContainer = container;

function Root() {
  const antdLocale = useAntdLocale();

  return (
    <StrictMode>
      <ConfigProvider locale={antdLocale ?? zhCN}>
        <App />
      </ConfigProvider>
    </StrictMode>
  );
}

async function start() {
  try {
    await bootstrapWorkspaceLocale(PREVIEW_WORKSPACE_ID);
  } catch {
    // Fall back to browser locale if workspace preferences are unavailable.
  }

  createRoot(rootContainer).render(<Root />);
}

void start();
