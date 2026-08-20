import { Injectable } from '@nestjs/common';
import { AISuggestionPriority } from '@prisma/client';

@Injectable()
export class AITestPrioritizerService {
  prioritize(text: string): AISuggestionPriority {
    const value = text.toLowerCase();

    if (
      value.includes('login') ||
      value.includes('auth') ||
      value.includes('password') ||
      value.includes('mot de passe') ||
      value.includes('payment') ||
      value.includes('paiement') ||
      value.includes('checkout') ||
      value.includes('panier')
    ) {
      return AISuggestionPriority.CRITICAL;
    }

    if (
      value.includes('form') ||
      value.includes('input') ||
      value.includes('required') ||
      value.includes('obligatoire') ||
      value.includes('submit') ||
      value.includes('validation')
    ) {
      return AISuggestionPriority.HIGH;
    }

    if (
      value.includes('search') ||
      value.includes('recherche') ||
      value.includes('navigation') ||
      value.includes('menu') ||
      value.includes('link') ||
      value.includes('lien')
    ) {
      return AISuggestionPriority.MEDIUM;
    }

    return AISuggestionPriority.LOW;
  }
}