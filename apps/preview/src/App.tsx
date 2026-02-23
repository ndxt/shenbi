import { useEffect, useMemo } from 'react';
import * as antd from 'antd';
import {
  antdResolver,
  compileSchema,
  Container,
  ShenbiPage,
  usePageRuntime,
} from '@shenbi/engine';
import { installMockFetch } from './mock/mock-fetch';
import { userManagementSchema } from './schemas/user-management';

import { AppShell } from './ui/AppShell';

const resolver = antdResolver(antd);
resolver.register('Container', Container);

export function App() {
  useEffect(() => {
    const isTest = process.env.NODE_ENV === 'test';
    const controller = installMockFetch({
      minDelayMs: isTest ? 0 : 200,
      maxDelayMs: isTest ? 0 : 500,
    });
    return () => {
      controller.restore();
    };
  }, []);

  const runtime = usePageRuntime(userManagementSchema, {
    message: antd.message,
    notification: antd.notification,
  });

  const compiledBody = useMemo(
    () => compileSchema(userManagementSchema.body, resolver),
    [],
  );

  return (
    <AppShell>
      <ShenbiPage
        schema={userManagementSchema}
        resolver={resolver}
        runtime={runtime}
        compiledBody={compiledBody}
      />
    </AppShell>
  );
}
