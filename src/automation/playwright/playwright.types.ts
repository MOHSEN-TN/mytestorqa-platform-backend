export type ExplorerInput = {
  targetUrl: string;
  depth?: number;
  authenticationRequired?: boolean;
  username?: string;
  password?: string;
};

export type ExploredLink = {
  text: string;
  href: string;
};

export type ExploredInput = {
  name?: string;
  type?: string;
  placeholder?: string;
  label?: string;
};

export type ExploredButton = {
  text: string;
};

export type ExploredForm = {
  action?: string;
  method?: string;
  inputs: ExploredInput[];
};

export type ExploredPage = {
  url: string;
  title: string;
  headings: string[];
  links: ExploredLink[];
  buttons: ExploredButton[];
  inputs: ExploredInput[];
  forms: ExploredForm[];
  consoleErrors: string[];
};

export type ExplorationResult = {
  startUrl: string;
  depth: number;
  pages: ExploredPage[];
  errors: string[];
};

export type PlaywrightGeneratedCode = {
  testCaseId: string;
  title: string;
  framework: 'playwright';
  language: 'typescript';
  code: string;
};

export type PlaywrightRunResult = {
  status: 'PASSED' | 'FAILED';
  title?: string;
  finalUrl?: string;
  durationMs: number;
  errors: string[];
};