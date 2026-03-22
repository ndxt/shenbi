// Standalone debug entry for GatewayEditor
import React from 'react';
import { createRoot } from 'react-dom/client';
import { GatewayEditor } from '@shenbi/editor-plugin-gateway';

function GatewayDebugApp() {
  return (
    <div style={{ width: '100%', height: '100%' }}>
      <GatewayEditor />
    </div>
  );
}

const root = createRoot(document.getElementById('root')!);
root.render(<GatewayDebugApp />);
