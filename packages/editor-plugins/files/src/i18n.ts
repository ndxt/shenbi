import { registerTranslationNamespace } from '@shenbi/i18n';

export const filesLocaleResources = {
  'zh-CN': {
    title: '文件',
    pluginName: '文件插件',
    empty: '暂无文件，点击上方按钮创建',
    confirmDelete: '确定删除？',
    status: {
      noBoundFile: '当前未绑定文件',
      noActiveFile: '无活动文件',
      unsavedShort: '未保存',
      savedShort: '已保存',
      autoSaved: '已自动保存',
      saved: '已保存: {{fileId}}',
      opened: '已打开: {{fileId}}',
      listLoadFailed: '文件列表加载失败: {{message}}',
      saveAsFailed: '另存失败: {{message}}',
      openFailed: '打开失败: {{message}}',
      saveFailed: '保存失败: {{message}}',
      undoFailed: '撤销失败: {{message}}',
      redoFailed: '重做失败: {{message}}',
      createOrOpenFirst: '请先从文件树创建或打开文件'
    },
    toolbar: {
      saveCurrentFile: '保存当前文件',
      newFile: '新建文件',
      newFolder: '新建文件夹',
      refresh: '刷新',
      collapseAll: '全部折叠'
    },
    menu: {
      newFile: '新建文件',
      newFolder: '新建文件夹',
      newPage: '新建页面',
      newApi: '新建 API',
      newFlow: '新建流程',
      newDb: '新建数据表',
      newDict: '新建字典',
      rename: '重命名',
      delete: '删除'
    },
    filePanel: {
      save: '保存',
      saveAs: '另存为',
      refresh: '刷新',
      open: '打开',
      empty: '暂无文件，点击“另存为”创建'
    }
  },
  'en-US': {
    title: 'Files',
    pluginName: 'Files Plugin',
    empty: 'No files. Click the button above to create one.',
    confirmDelete: 'Are you sure you want to delete this item?',
    status: {
      noBoundFile: 'No file is currently bound',
      noActiveFile: 'No active file',
      unsavedShort: 'Unsaved',
      savedShort: 'Saved',
      autoSaved: 'Auto-saved',
      saved: 'Saved: {{fileId}}',
      opened: 'Opened: {{fileId}}',
      listLoadFailed: 'Failed to load file list: {{message}}',
      saveAsFailed: 'Failed to save as: {{message}}',
      openFailed: 'Failed to open file: {{message}}',
      saveFailed: 'Failed to save file: {{message}}',
      undoFailed: 'Undo failed: {{message}}',
      redoFailed: 'Redo failed: {{message}}',
      createOrOpenFirst: 'Create or open a file from the file tree first'
    },
    toolbar: {
      saveCurrentFile: 'Save current file',
      newFile: 'New File',
      newFolder: 'New Folder',
      refresh: 'Refresh',
      collapseAll: 'Collapse All'
    },
    menu: {
      newFile: 'New File',
      newFolder: 'New Folder',
      newPage: 'New Page',
      newApi: 'New API',
      newFlow: 'New Flow',
      newDb: 'New Database',
      newDict: 'New Dictionary',
      rename: 'Rename',
      delete: 'Delete'
    },
    filePanel: {
      save: 'Save',
      saveAs: 'Save As',
      refresh: 'Refresh',
      open: 'Open',
      empty: 'No files. Click "Save As" to create one.'
    }
  }
} as const;

registerTranslationNamespace('pluginFiles', filesLocaleResources);
