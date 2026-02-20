import { Card, Typography } from 'antd';

export function App() {
  return (
    <div style={{ padding: 24 }}>
      <Card>
        <Typography.Title level={3}>Shenbi Preview</Typography.Title>
        <Typography.Paragraph>
          M0 scaffold is ready. Runtime/compiler/renderer integration starts in MVP-1.
        </Typography.Paragraph>
      </Card>
    </div>
  );
}
