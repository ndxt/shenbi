import { useCallback, useEffect, useMemo, useState } from 'react';
import * as antd from 'antd';
import { Line, Column, Bar, Area, Pie, Gauge } from '@ant-design/charts';
import { type PageSchema } from '@shenbi/schema';
import {
  antdResolver,
  compileSchema,
  Container,
  ShenbiPage,
  usePageRuntime,
} from '@shenbi/engine';
import { installMockFetch } from '../mock/mock-fetch';

const resolver = antdResolver(antd);
resolver.register('Container', Container);
// Ant Design Charts
resolver.register('Chart.Line', Line);
resolver.register('Chart.Column', Column);
resolver.register('Chart.Bar', Bar);
resolver.register('Chart.Area', Area);
resolver.register('Chart.Pie', Pie);
resolver.register('Chart.Gauge', Gauge);

export interface ScenarioRuntimeViewProps {
  schema: PageSchema;
}

export function ScenarioRuntimeView({ schema }: ScenarioRuntimeViewProps) {
  const [pageRoot, setPageRoot] = useState<HTMLElement | null>(null);
  const supportsScopedMessage = typeof antd.message.useMessage === 'function';
  const supportsScopedNotification = typeof antd.notification.useNotification === 'function';
  const [messageApi, messageContextHolder] = supportsScopedMessage
    ? antd.message.useMessage()
    : [antd.message, null];
  const [notificationApi, notificationContextHolder] = supportsScopedNotification
    ? antd.notification.useNotification()
    : [antd.notification, null];

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

  const getPopupContainer = useCallback(() => {
    return pageRoot ?? document.body;
  }, [pageRoot]);

  const runtime = usePageRuntime(schema, {
    message: messageApi,
    notification: notificationApi,
    getPopupContainer,
  });

  const compiledBody = useMemo(
    () => compileSchema(schema.body, resolver),
    [schema],
  );

  return (
    <antd.ConfigProvider getPopupContainer={getPopupContainer}>
      <antd.App>
        {messageContextHolder}
        {notificationContextHolder}
        <ShenbiPage
          schema={schema}
          resolver={resolver}
          runtime={runtime}
          compiledBody={compiledBody}
          onRootReady={setPageRoot}
        />
      </antd.App>
    </antd.ConfigProvider>
  );
}
