import { useMemo } from 'react';
import * as antd from 'antd';
import {
  antdResolver,
  compileSchema,
  Container,
  ShenbiPage,
  usePageRuntime,
} from '@shenbi/engine';
import { demoPageSchema } from './demo-schema';
import type { CompiledNode } from '@shenbi/engine';

import { AppShell } from './ui/AppShell';

const resolver = antdResolver(antd);
resolver.register('Container', Container);

export function App() {
  const runtime = usePageRuntime(demoPageSchema, {
    message: antd.message,
    notification: antd.notification,
    confirm: antd.Modal.confirm,
  });

  const compiledBody = useMemo(
    () => compileSchema(demoPageSchema.body, resolver),
    [],
  );

  const compiledDialogs = useMemo<CompiledNode[] | undefined>(() => {
    if (!demoPageSchema.dialogs || demoPageSchema.dialogs.length === 0) {
      return undefined;
    }
    return compileSchema(demoPageSchema.dialogs, resolver) as CompiledNode[];
  }, []);

  const dialogProps = useMemo(
    () => (compiledDialogs ? { compiledDialogs } : {}),
    [compiledDialogs],
  );

  return (
    <AppShell>
      <ShenbiPage
        schema={demoPageSchema}
        resolver={resolver}
        runtime={runtime}
        compiledBody={compiledBody}
        {...dialogProps}
      />
    </AppShell>
  );
}
