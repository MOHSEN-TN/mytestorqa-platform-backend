export type TestExecutionStatus =
  | 'PASSED'
  | 'FAILED'
  | 'ERROR'
  | 'SKIPPED';

export type TestExecutionGlobalStatus = Exclude<
  TestExecutionStatus,
  'SKIPPED'
>;

export type TestExecutionStep = {
  order: number;
  title: string;
  status: TestExecutionStatus;

  startedAt: string | null;
  finishedAt: string | null;
  failedAt: string | null;
  durationMs: number;

  expectedResult: string | null;
  actualResult: string | null;

  error: string | null;
  screenshotUrl: string | null;
};

export type TestFailureDetails = {
  /**
   * Emplacement dans le code Playwright enregistré par l'utilisateur.
   */
  sourceFile: string | null;
  sourceLine: number | null;
  sourceColumn: number | null;
  sourceSnippet: string | null;

  /**
   * Élément Playwright concerné par l'échec.
   * Exemple : locator('#description')
   */
  locator: string | null;

  /**
   * Comparaison fonctionnelle affichée dans le frontend.
   */
  expectedResult: string | null;
  actualResult: string | null;

  /**
   * Message court et lisible.
   * Le rapport technique complet reste dans les artefacts.
   */
  message: string | null;

  /**
   * Preuves accessibles à la demande.
   */
  screenshotUrl: string | null;
  traceUrl: string | null;
  artifactsZipUrl: string | null;
  executionReportUrl: string | null;
};

export type TestExecutionReport = {
  runId: string;
  testCaseId: string | null;

  status: TestExecutionGlobalStatus;
  browser: 'CHROMIUM';
  mode: 'HEADLESS' | 'HEADED';

  startedAt: string;
  finishedAt: string;
  failedAt: string | null;
  durationMs: number;

  summary: {
    total: number;
    passed: number;
    failed: number;
    errors: number;
    skipped: number;
  };

  /**
   * Étapes structurées conservées pour la page Rapports.
   * Le frontend immédiat peut se limiter à failureDetails.
   */
  steps: TestExecutionStep[];

  /**
   * Résumé de l'échec destiné à l'affichage immédiat.
   * Null lorsque le test est réussi.
   */
  failureDetails: TestFailureDetails | null;

  /**
   * Erreur globale conservée pour compatibilité.
   */
  error: string | null;

  /**
   * Compatibilité avec l'interface actuelle.
   */
  screenshotUrl: string | null;

  /**
   * Accès direct aux artefacts complets.
   */
  traceUrl: string | null;
  artifactsZipUrl: string | null;
  executionReportUrl: string | null;
};
