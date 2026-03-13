import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { FileText, Rocket } from 'lucide-react';
import { defineEditorPlugin } from '@shenbi/editor-plugin-api';
import type { TabState } from '@shenbi/editor-core';
import { AppShell as RawAppShell } from './AppShell';

type AppShellProps = Omit<React.ComponentProps<typeof RawAppShell>, 'workspaceId'> & {
  workspaceId?: string;
};

function AppShell(props: AppShellProps) {
  return <RawAppShell {...props} workspaceId={props.workspaceId ?? 'primary-panel-workspace'} />;
}

function createTab(fileType: TabState['fileType']): TabState {
  return {
    fileId: `${fileType}-1`,
    filePath: `/${fileType}-1.json`,
    fileType,
    fileName: `${fileType}-1`,
    schema: {
      id: `${fileType}-schema`,
      name: `${fileType}-schema`,
      body: [],
    },
    isDirty: false,
  };
}

describe('AppShell primary panels', () => {
  it('renders a files primary panel and page file context panel at the same time', () => {
    render(
      <AppShell
        plugins={[
          defineEditorPlugin({
            id: 'plugin.files-panel',
            name: 'Files Panel',
            contributes: {
              activityBarItems: [
                {
                  id: 'files',
                  label: 'Files',
                  icon: FileText,
                  order: 5,
                  active: true,
                  target: { type: 'panel', panelId: 'files' },
                },
              ],
              primaryPanels: [
                {
                  id: 'files',
                  label: 'Files',
                  order: 5,
                  render: () => <div>Files Primary Panel</div>,
                },
              ],
            },
          }),
        ]}
        tabs={[createTab('page')]}
        activeTabId="page-1"
      >
        <div>Canvas</div>
      </AppShell>,
    );

    expect(screen.getByText('Files Primary Panel')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Search components...')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Components' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Outline' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Data' })).toBeInTheDocument();
    expect(screen.queryByText('Sidebar plugin loaded')).toBeNull();
  });

  it('adapts legacy sidebarTabs into the page file context panel', () => {
    render(
      <AppShell
        plugins={[
          defineEditorPlugin({
            id: 'plugin.assets',
            name: 'Assets',
            contributes: {
              activityBarItems: [
                {
                  id: 'assets-activity',
                  label: 'Assets',
                  icon: Rocket,
                  order: 99,
                  targetSidebarTabId: 'assets',
                },
              ],
              sidebarTabs: [
                {
                  id: 'assets',
                  label: 'Assets',
                  order: 99,
                  render: () => <div>Assets Compatibility Panel</div>,
                },
              ],
            },
          }),
        ]}
        tabs={[createTab('page')]}
        activeTabId="page-1"
      >
        <div>Canvas</div>
      </AppShell>,
    );

    fireEvent.click(screen.getByLabelText('Assets'));
    expect(screen.getByText('Assets Compatibility Panel')).toBeInTheDocument();
  });

  it('does not show the page file context panel for non-page files', () => {
    render(
      <AppShell
        plugins={[
          defineEditorPlugin({
            id: 'plugin.files-panel',
            name: 'Files Panel',
            contributes: {
              activityBarItems: [
                {
                  id: 'files',
                  label: 'Files',
                  icon: FileText,
                  order: 5,
                  active: true,
                  target: { type: 'panel', panelId: 'files' },
                },
              ],
              primaryPanels: [
                {
                  id: 'files',
                  label: 'Files',
                  order: 5,
                  render: () => <div>Files Primary Panel</div>,
                },
              ],
            },
          }),
        ]}
        tabs={[createTab('api')]}
        activeTabId="api-1"
      >
        <div>Canvas</div>
      </AppShell>,
    );

    expect(screen.getByText('Files Primary Panel')).toBeInTheDocument();
    expect(screen.queryByPlaceholderText('Search components...')).toBeNull();
  });
});
