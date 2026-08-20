import {
  BadRequestException,
  Injectable,
} from '@nestjs/common';
import * as ts from 'typescript';

@Injectable()
export class PlaywrightCodeNormalizerService {
  normalize(rawCode: string): string {
    const cleanedCode =
      this.removeMarkdownBlocks(rawCode);

    if (!cleanedCode.trim()) {
      throw new BadRequestException(
        'Le code Playwright est vide.',
      );
    }

    const result = ts.transpileModule(
      cleanedCode,
      {
        fileName: 'automation.spec.ts',
        reportDiagnostics: true,
        compilerOptions: {
          target: ts.ScriptTarget.ES2022,
          module: ts.ModuleKind.ESNext,
          isolatedModules: true,
          esModuleInterop: true,
          removeComments: false,
          sourceMap: false,
        },
      },
    );

    const errors = (
      result.diagnostics ?? []
    ).filter(
      (diagnostic) =>
        diagnostic.category ===
        ts.DiagnosticCategory.Error,
    );

    if (errors.length > 0) {
      const messages = errors.map(
        (diagnostic) => {
          const message =
            ts.flattenDiagnosticMessageText(
              diagnostic.messageText,
              '\n',
            );

          if (
            diagnostic.file &&
            diagnostic.start !== undefined
          ) {
            const position =
              diagnostic.file
                .getLineAndCharacterOfPosition(
                  diagnostic.start,
                );

            return `Ligne ${
              position.line + 1
            }, colonne ${
              position.character + 1
            } : ${message}`;
          }

          return message;
        },
      );

      throw new BadRequestException({
        message:
          'Le code Playwright généré contient une erreur de syntaxe.',
        errors: messages,
      });
    }

    return result.outputText.trim();
  }

  private removeMarkdownBlocks(
    code: string,
  ): string {
    return code
      .trim()
      .replace(
        /^```(?:typescript|ts|javascript|js)?\s*/i,
        '',
      )
      .replace(/\s*```$/i, '')
      .trim();
  }
}