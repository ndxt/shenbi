import { createPreviewGitLabService } from './gitlab/previewGitLabService';
import type { PreviewServiceContainer } from '../preview-types';

export function createPreviewServiceContainer(): PreviewServiceContainer {
  return {
    gitlab: createPreviewGitLabService(),
  };
}

export { createPreviewGitLabService } from './gitlab/previewGitLabService';
