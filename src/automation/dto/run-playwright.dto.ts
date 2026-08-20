export type RunPlaywrightDto = {
  targetUrl: string;
  headless?: boolean;
  timeoutMs?: number;
};