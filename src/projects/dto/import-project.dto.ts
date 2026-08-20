export type ImportProjectPreviewStatus =
  | 'READY'
  | 'PROJECT_ALREADY_EXISTS'
  | 'INVALID';

export type ImportProjectPreviewItem = {
  projectKey: string;
  name: string;
  status: ImportProjectPreviewStatus;
  suites: number;
  testCases: number;
  steps: number;
  message?: string;
};

export type ImportProjectPreviewDto = {
  valid: boolean;
  templateVersion: string | null;
  projectsFound: number;
  suitesFound: number;
  testCasesFound: number;
  stepsFound: number;
  projects: ImportProjectPreviewItem[];
  errors: string[];
};

export type ImportProjectResultItem = {
  projectKey: string;
  name: string;
  projectId: string;
  suites: number;
  testCases: number;
  steps: number;
};

export type ImportProjectSkippedItem = {
  projectKey: string;
  name: string;
  reason: 'PROJECT_ALREADY_EXISTS' | 'INVALID_PROJECT';
  message: string;
};

export type ImportProjectResultDto = {
  imported: ImportProjectResultItem[];
  skipped: ImportProjectSkippedItem[];
  errors: string[];
};
