import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import 'antd/dist/reset.css';
import '@shenbi/i18n';
import { useAntdLocale } from '@shenbi/i18n';
import { App } from './App';

const container = document.getElementById('root');

if (!container) {
  throw new Error('Root element not found');
}

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

createRoot(container).render(<Root />);
