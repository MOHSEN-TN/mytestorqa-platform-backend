export const PROJECT_TRANSFER_TEMPLATE_VERSION = '1';

export type ExportProjectSummaryDto = {
  fileName: string;
  contentType: string;
  projectCount: number;
  suiteCount: number;
  testCaseCount: number;
  stepCount: number;
};

export type ExportProjectResultDto = {
  fileName: string;
  contentType: string;
  buffer: Buffer;
  summary: ExportProjectSummaryDto;
};
