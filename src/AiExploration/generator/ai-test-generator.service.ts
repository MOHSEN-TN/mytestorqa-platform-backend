import { Injectable } from '@nestjs/common';
import { ExplorationResult } from '../../automation/playwright/playwright.types';
import { AITestPrioritizerService } from '../prioritization/ai-test-prioritizer.service';
import { GeneratedAISuggestion } from './ai-test-generator.types';

@Injectable()
export class AITestGeneratorService {
  constructor(
    private readonly prioritizerService: AITestPrioritizerService,
  ) {}

  generateFromExploration(
    result: ExplorationResult,
    options?: {
      generateNegativeTests?: boolean;
      generateGherkin?: boolean;
      generatePlaywright?: boolean;
    },
  ): GeneratedAISuggestion[] {
    const suggestions: GeneratedAISuggestion[] = [];

    for (const page of result.pages) {
      suggestions.push(
        this.createSuggestion(
          `Vérifier le chargement de la page "${page.title || page.url}"`,
          `Contrôler que la page ${page.url} se charge correctement sans erreur bloquante.`,
          `La page doit afficher son contenu principal et rester accessible.`,
        ),
      );

      for (const input of page.inputs.slice(0, 5)) {
        const name =
          input.label ||
          input.placeholder ||
          input.name ||
          input.type ||
          'champ';

        suggestions.push(
          this.createSuggestion(
            `Vérifier le champ "${name}"`,
            `Contrôler le comportement du champ ${name} sur la page ${page.url}.`,
            `Le champ doit accepter les données valides et afficher une validation claire si nécessaire.`,
          ),
        );
      }

      for (const button of page.buttons.slice(0, 5)) {
        suggestions.push(
          this.createSuggestion(
            `Vérifier l’action du bouton "${button.text}"`,
            `Cliquer sur le bouton "${button.text}" et vérifier le comportement attendu.`,
            `Le bouton doit déclencher l’action prévue sans erreur.`,
          ),
        );
      }

      for (const link of page.links.slice(0, 5)) {
        if (!link.text) {
          continue;
        }

        suggestions.push(
          this.createSuggestion(
            `Vérifier la navigation vers "${link.text}"`,
            `Cliquer sur le lien "${link.text}" depuis ${page.url}.`,
            `L’utilisateur doit être redirigé vers la bonne page.`,
          ),
        );
      }

      if (page.forms.length > 0) {
        suggestions.push(
          this.createSuggestion(
            `Vérifier la soumission des formulaires`,
            `Contrôler les formulaires présents sur ${page.url}, avec données valides.`,
            `Les formulaires doivent être soumis correctement ou afficher un message clair.`,
          ),
        );

        if (options?.generateNegativeTests) {
          suggestions.push(
            this.createSuggestion(
              `Vérifier les erreurs de validation formulaire`,
              `Soumettre les formulaires de ${page.url} avec des champs vides ou invalides.`,
              `Le système doit refuser les données invalides et afficher des messages d’erreur.`,
            ),
          );
        }
      }

      if (page.consoleErrors.length > 0) {
        suggestions.push(
          this.createSuggestion(
            `Vérifier les erreurs console`,
            `La page ${page.url} contient des erreurs console détectées pendant l’exploration.`,
            `Aucune erreur JavaScript critique ne doit apparaître dans la console.`,
          ),
        );
      }
    }

    return this.removeDuplicates(suggestions).slice(0, 30);
  }

  private createSuggestion(
    title: string,
    description: string,
    expectedResult: string,
  ): GeneratedAISuggestion {
    return {
      title,
      description,
      expectedResult,
      priority: this.prioritizerService.prioritize(
        `${title} ${description} ${expectedResult}`,
      ),
    };
  }

  private removeDuplicates(suggestions: GeneratedAISuggestion[]) {
    const seen = new Set<string>();

    return suggestions.filter((suggestion) => {
      const key = suggestion.title.toLowerCase();

      if (seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    });
  }
}