import type { ReactElement } from 'react';
import type { PageSchema } from '@shenbi/schema';
import type { ComponentResolver } from '../types/contracts';

export interface ShenbiPageProps {
  schema: PageSchema;
  resolver: ComponentResolver;
  params?: Record<string, any>;
}

export function ShenbiPage(_props: ShenbiPageProps): ReactElement | null {
  throw new Error('Not implemented: renderer/shenbi-page.tsx');
}
