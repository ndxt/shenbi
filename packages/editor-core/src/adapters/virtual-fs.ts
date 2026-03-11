import type { FileContent, FileType, FSNodeMetadata } from './file-storage';

export interface VirtualFileSystemAdapter {
  initialize(projectId: string): Promise<void>;
  listTree(projectId: string): Promise<FSNodeMetadata[]>;

  // File CRUD
  createFile(
    projectId: string,
    parentId: string | null,
    name: string,
    fileType: FileType,
    content: FileContent,
  ): Promise<FSNodeMetadata>;
  readFile(projectId: string, fileId: string): Promise<FileContent>;
  writeFile(projectId: string, fileId: string, content: FileContent): Promise<void>;
  deleteFile(projectId: string, fileId: string): Promise<void>;

  // Directory CRUD
  createDirectory(
    projectId: string,
    parentId: string | null,
    name: string,
  ): Promise<FSNodeMetadata>;
  deleteDirectory(projectId: string, dirId: string, recursive?: boolean): Promise<void>;

  // Rename & Move
  rename(projectId: string, nodeId: string, newName: string): Promise<FSNodeMetadata>;
  move(projectId: string, nodeId: string, newParentId: string | null): Promise<FSNodeMetadata>;

  // Query
  getNode(projectId: string, nodeId: string): Promise<FSNodeMetadata | undefined>;
  getNodeByPath(projectId: string, path: string): Promise<FSNodeMetadata | undefined>;
}
