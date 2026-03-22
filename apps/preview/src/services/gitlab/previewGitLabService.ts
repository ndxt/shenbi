import {
  getAuthStatus,
  listBranches,
  listGroupProjects,
  logout,
  type GitLabAuthStatus,
  type GitLabProject,
} from '../../../../../packages/editor-plugins/gitlab-sync/src/gitlab-client';
import { projectIdFromGitLab, type ActiveProjectConfig } from '../../constants';
import type {
  PreviewGitLabAuthStatus,
  PreviewGitLabProject,
  PreviewGitLabService,
} from '../../preview-types';

function mapAuthStatus(status: GitLabAuthStatus): PreviewGitLabAuthStatus {
  return {
    authenticated: status.authenticated,
    ...(status.user ? { user: status.user } : {}),
    ...(status.defaultGroupId ? { defaultGroupId: status.defaultGroupId } : {}),
    ...(status.defaultInstanceUrl ? { defaultInstanceUrl: status.defaultInstanceUrl } : {}),
  };
}

function mapProject(project: GitLabProject): PreviewGitLabProject {
  return {
    id: project.id,
    name: project.name,
    name_with_namespace: project.name_with_namespace,
    path_with_namespace: project.path_with_namespace,
    description: project.description,
    web_url: project.web_url,
    default_branch: project.default_branch,
    last_activity_at: project.last_activity_at,
  };
}

function toProjectConfig(project: PreviewGitLabProject): ActiveProjectConfig {
  const projectId = projectIdFromGitLab(project.id);
  return {
    id: projectId,
    gitlabProjectId: project.id,
    vfsProjectId: projectId,
    projectName: project.name,
    branch: project.default_branch || 'main',
    createdAt: Date.now(),
    lastOpenedAt: Date.now(),
    gitlabUrl: project.web_url,
  };
}

export function createPreviewGitLabService(): PreviewGitLabService {
  return {
    async getAuthStatus() {
      return mapAuthStatus(await getAuthStatus());
    },
    async logout() {
      await logout();
    },
    async listBranches(projectId: number) {
      return (await listBranches(projectId)).map((branch) => branch.name);
    },
    async listGroupProjects(groupId: number, search?: string) {
      return (await listGroupProjects(groupId, search)).map(mapProject);
    },
    selectProjectMetadata(project: PreviewGitLabProject) {
      return toProjectConfig(project);
    },
  };
}
