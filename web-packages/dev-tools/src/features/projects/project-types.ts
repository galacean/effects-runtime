export const DEFAULT_PROJECT_ID = 'default-project';

export interface ProjectRecord {
  id: string,
  name: string,
  description: string,
  createdAt: number,
  updatedAt: number,
  lastOpenedAt: number,
  startupSceneId?: string,
  deletedAt?: number,
}

export type ProjectSettings = Pick<ProjectRecord, 'name' | 'description' | 'startupSceneId'>;
