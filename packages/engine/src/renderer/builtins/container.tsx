import type { CSSProperties, ReactNode } from 'react';

export interface ContainerProps {
  children?: ReactNode;
  direction?: CSSProperties['flexDirection'];
  gap?: number;
  wrap?: CSSProperties['flexWrap'];
  style?: CSSProperties;
}

export function Container(props: ContainerProps) {
  const { children, direction = 'column', gap = 0, wrap = 'nowrap', style } = props;
  return (
    <div style={{ display: 'flex', flexDirection: direction, gap, flexWrap: wrap, ...style }}>
      {children}
    </div>
  );
}

export function PageEmbed({ children }: { children?: ReactNode }) {
  return <>{children}</>;
}
