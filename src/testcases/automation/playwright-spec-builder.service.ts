import {
  BadRequestException,
  Injectable,
} from '@nestjs/common';
import * as ts from 'typescript';

export type BuildPlaywrightSpecInput = {
  automationCode: string;
  runId: string;
  testCaseId?: string | null;
  testTitle?: string | null;
};

export type BuiltPlaywrightSpec = {
  fileName: string;
  sourceCode: string;
  originalCodeLength: number;
  wrapped: boolean;
};

@Injectable()
export class PlaywrightSpecBuilderService {
  private readonly maxCodeSizeBytes = 1024 * 1024;

  build(
    input: BuildPlaywrightSpecInput,
  ): BuiltPlaywrightSpec {
    const cleanedCode = this.normalizeCode(
      input.automationCode,
    );

    this.validateCode(cleanedCode);

    /*
     * Convertit automatiquement les syntaxes TypeScript en JavaScript
     * compatible avec tous les chemins d'exécution Playwright.
     *
     * Exemple :
     *   const errors: string[] = [];
     * devient :
     *   const errors = [];
     *
     * Cette étape corrige également les anciens scripts déjà enregistrés
     * en base au moment de leur exécution.
     */
    const executableCode =
      this.transpileToExecutableCode(cleanedCode);

    this.validateCode(executableCode);

    const hasPlaywrightImport =
      this.hasPlaywrightTestImport(executableCode);
    const hasTestDeclaration =
      this.hasPlaywrightTestDeclaration(executableCode);

    const safeRunId = this.safeFilePart(
      input.runId,
    );
    const safeTestCaseId = this.safeFilePart(
      input.testCaseId || 'unknown-testcase',
    );

    const fileName =
      `${safeTestCaseId}-${safeRunId}.spec.ts`;

    if (hasTestDeclaration) {
      const sourceCode = [
        this.buildMetadataHeader(input),
        hasPlaywrightImport
          ? executableCode
          : [
              "import { test, expect } from '@playwright/test';",
              '',
              executableCode,
            ].join('\n'),
      ].join('\n');

      return {
        fileName,
        sourceCode,
        originalCodeLength: cleanedCode.length,
        wrapped: false,
      };
    }

    const testTitle =
      this.escapeSingleQuotedString(
        input.testTitle?.trim() ||
          `MyTester automated test ${input.runId}`,
      );

    const body = this.indentCode(
      this.removePlaywrightImport(
        executableCode,
      ),
      2,
    );

    const sourceCode = [
      this.buildMetadataHeader(input),
      "import { test, expect } from '@playwright/test';",
      '',
      `test('${testTitle}', async ({ page }) => {`,
      body,
      '});',
      '',
    ].join('\n');

    return {
      fileName,
      sourceCode,
      originalCodeLength: cleanedCode.length,
      wrapped: true,
    };
  }

  private normalizeCode(
    code: string,
  ): string {
    return code
      .replace(/^\uFEFF/, '')
      .replace(/\r\n?/g, '\n')
      .trim()
      .replace(
        /^```(?:typescript|ts|javascript|js)?\s*/i,
        '',
      )
      .replace(/\s*```$/i, '')
      .trim();
  }

  private transpileToExecutableCode(
    code: string,
  ): string {
    const result = ts.transpileModule(code, {
      fileName: 'mytester-automation.spec.ts',
      reportDiagnostics: true,
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.ESNext,
        moduleResolution:
          ts.ModuleResolutionKind.NodeJs,
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
        isolatedModules: true,
        removeComments: false,
        sourceMap: false,
        inlineSourceMap: false,
        declaration: false,
        newLine: ts.NewLineKind.LineFeed,
      },
    });

    const syntaxErrors = (
      result.diagnostics ?? []
    ).filter(
      (diagnostic) =>
        diagnostic.category ===
        ts.DiagnosticCategory.Error,
    );

    if (syntaxErrors.length > 0) {
      const messages = syntaxErrors.map(
        (diagnostic) =>
          this.formatDiagnostic(diagnostic),
      );

      throw new BadRequestException({
        message:
          'Le code Playwright contient une erreur de syntaxe.',
        errors: messages,
      });
    }

    const output = result.outputText
      .replace(/\r\n?/g, '\n')
      .trim();

    if (!output) {
      throw new BadRequestException(
        'Le code Playwright est vide après normalisation',
      );
    }

    return output;
  }

  private formatDiagnostic(
    diagnostic: ts.Diagnostic,
  ): string {
    const message =
      ts.flattenDiagnosticMessageText(
        diagnostic.messageText,
        '\n',
      );

    if (
      !diagnostic.file ||
      diagnostic.start === undefined
    ) {
      return message;
    }

    const position =
      diagnostic.file.getLineAndCharacterOfPosition(
        diagnostic.start,
      );

    return [
      `Ligne ${position.line + 1}`,
      `colonne ${position.character + 1}`,
      message,
    ].join(' : ');
  }

  private validateCode(
    code: string,
  ): void {
    if (!code) {
      throw new BadRequestException(
        'Le code Playwright est obligatoire',
      );
    }

    if (
      Buffer.byteLength(code, 'utf8') >
      this.maxCodeSizeBytes
    ) {
      throw new BadRequestException(
        'Le code Playwright dépasse la taille maximale autorisée',
      );
    }

    const forbiddenPatterns: Array<{
      pattern: RegExp;
      message: string;
    }> = [
      {
        pattern:
          /from\s+['"](?:node:)?child_process['"]/i,
        message:
          'Les imports child_process ne sont pas autorisés',
      },
      {
        pattern:
          /require\s*\(\s*['"](?:node:)?child_process['"]\s*\)/i,
        message:
          'Les appels child_process ne sont pas autorisés',
      },
      {
        pattern:
          /from\s+['"](?:node:)?fs(?:\/promises)?['"]/i,
        message:
          'Les imports du système de fichiers ne sont pas autorisés',
      },
      {
        pattern:
          /require\s*\(\s*['"](?:node:)?fs(?:\/promises)?['"]\s*\)/i,
        message:
          'Les accès directs au système de fichiers ne sont pas autorisés',
      },
      {
        pattern:
          /\bprocess\s*\.\s*(?:exit|kill)\s*\(/i,
        message:
          'Les opérations process.exit/process.kill ne sont pas autorisées',
      },
      {
        pattern: /\beval\s*\(/i,
        message: 'eval() n’est pas autorisé',
      },
      {
        pattern:
          /\bnew\s+Function\s*\(/i,
        message:
          'Le constructeur Function n’est pas autorisé',
      },
    ];

    for (const rule of forbiddenPatterns) {
      if (rule.pattern.test(code)) {
        throw new BadRequestException(
          rule.message,
        );
      }
    }

    const externalImports = [
      ...code.matchAll(
        /(?:import[\s\S]*?from\s+|require\s*\()\s*['"]([^'"]+)['"]/g,
      ),
    ].map((match) => match[1]);

    const unsupportedImport =
      externalImports.find(
        (moduleName) =>
          moduleName !== '@playwright/test',
      );

    if (unsupportedImport) {
      throw new BadRequestException(
        `Import non autorisé dans le scénario Playwright : ${unsupportedImport}`,
      );
    }
  }

  private hasPlaywrightTestImport(
    code: string,
  ): boolean {
    return /(?:import[\s\S]*?from\s+|require\s*\()\s*['"]@playwright\/test['"]/.test(
      code,
    );
  }

  private hasPlaywrightTestDeclaration(
    code: string,
  ): boolean {
    return /\btest(?:\.(?:only|skip|fixme|fail|slow))?\s*\(/.test(
      code,
    );
  }

  private removePlaywrightImport(
    code: string,
  ): string {
    return code
      .replace(
        /import\s+\{[\s\S]*?\}\s+from\s+['"]@playwright\/test['"];?\s*/g,
        '',
      )
      .replace(
        /const\s+\{[\s\S]*?\}\s*=\s*require\s*\(\s*['"]@playwright\/test['"]\s*\);?\s*/g,
        '',
      )
      .trim();
  }

  private buildMetadataHeader(
    input: BuildPlaywrightSpecInput,
  ): string {
    return [
      '// Generated by MyTester',
      `// Run ID: ${input.runId}`,
      `// Test case ID: ${input.testCaseId ?? 'none'}`,
      `// Generated at: ${new Date().toISOString()}`,
    ].join('\n');
  }

  private indentCode(
    code: string,
    spaces: number,
  ): string {
    const indentation = ' '.repeat(spaces);

    return code
      .split('\n')
      .map((line) =>
        line.trim()
          ? `${indentation}${line}`
          : '',
      )
      .join('\n');
  }

  private escapeSingleQuotedString(
    value: string,
  ): string {
    return value
      .replace(/\\/g, '\\\\')
      .replace(/'/g, "\\'")
      .replace(/\r?\n/g, ' ');
  }

  private safeFilePart(
    value: string,
  ): string {
    return value
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .slice(0, 120);
  }
}
