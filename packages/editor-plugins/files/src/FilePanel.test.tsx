import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FilePanel } from './FilePanel';

describe('FilePanel', () => {
  it('显示文件列表并支持操作回调', () => {
    const onOpenFile = vi.fn();
    const onSaveFile = vi.fn();
    const onSaveAsFile = vi.fn();
    const onRefresh = vi.fn();

    render(
      <FilePanel
        files={[
          { id: 'file-1', name: 'Demo Page', updatedAt: Date.now() },
        ]}
        activeFileId="file-1"
        status="已保存: file-1"
        onOpenFile={onOpenFile}
        onSaveFile={onSaveFile}
        onSaveAsFile={onSaveAsFile}
        onRefresh={onRefresh}
      />,
    );

    expect(screen.getByText('Demo Page')).toBeInTheDocument();
    expect(screen.getByText('已保存: file-1')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save As' }));
    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));
    fireEvent.click(screen.getByRole('button', { name: 'Open' }));

    expect(onSaveFile).toHaveBeenCalledTimes(1);
    expect(onSaveAsFile).toHaveBeenCalledTimes(1);
    expect(onRefresh).toHaveBeenCalledTimes(1);
    expect(onOpenFile).toHaveBeenCalledWith('file-1');
  });
});
