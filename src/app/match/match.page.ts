import { Component, inject, signal } from '@angular/core';
import {
  FavoriteMovie,
  FirebaseService,
  MatchProfile,
} from '../services/firebase.service';
import { normalizeMatchNames } from '../services/movie-normalization';

interface Preferences {
  genreKeys: string[];
  actorKeys: string[];
  directorKeys: string[];
  years: number[];
}

interface MatchResult {
  profile: MatchProfile;
  score: number;
  genreScore: number;
  actorScore: number;
  directorScore: number;
  yearScore: number;
}

@Component({
  selector: 'app-match',
  templateUrl: './match.page.html',
  styleUrls: ['./match.page.scss'],
  standalone: false,
})
export class MatchPage {
  private readonly firebaseService = inject(FirebaseService);

  matches = signal<MatchResult[]>([]);
  isLoading = signal(true);
  message = signal('');

  // Recharge les correspondances chaque fois que l’utilisateur ouvre cette page.
  ionViewWillEnter(): void {
    void this.loadMatches();
  }

  // Vérifie les conditions nécessaires, récupère les profils et calcule les correspondances.
  private async loadMatches(): Promise<void> {
    this.isLoading.set(true);
    this.message.set('');
    this.matches.set([]);

    try {
      if (!this.firebaseService.auth.currentUser) {
        this.message.set('Connecte-toi pour consulter les correspondances.');
        return;
      }

      const participationActive =
        await this.firebaseService.getMatchingEnabled();

      if (!participationActive) {
        this.message.set(
          'Active « Participer au matching » dans Paramètres pour voir les correspondances.',
        );
        return;
      }

      const favorites = await this.firebaseService.getFavorites();

      if (favorites.length < 3) {
        this.message.set(
          'Ajoute au moins 3 films à tes favoris pour calculer tes correspondances.',
        );
        return;
      }

      const profiles = await this.firebaseService.getOtherMatchProfiles();
      const myPreferences = this.createPreferences(favorites);

      const results = profiles
        .map((profile) => this.calculateMatch(myPreferences, profile))
        .filter((result) => result.score > 75)
        .sort((a, b) => b.score - a.score);

      this.matches.set(results);

      if (results.length === 0) {
        this.message.set(
          'Aucune correspondance supérieure à 75 % pour le moment.',
        );
      }
    } catch (error: unknown) {
      console.error('Erreur lors du chargement des correspondances :', error);
      this.message.set(
        'Impossible de charger les correspondances. Vérifie ta connexion et les règles Firestore.',
      );
    } finally {
      this.isLoading.set(false);
    }
  }

  // Construit les préférences de l’utilisateur à partir de ses films favoris.
  private createPreferences(favorites: FavoriteMovie[]): Preferences {
    const years = favorites
      .map((favorite) => Number(favorite.releaseDate.slice(0, 4)))
      .filter((year) => Number.isInteger(year) && year >= 1888 && year <= 2100);

    return {
      genreKeys: normalizeMatchNames(
        favorites.flatMap((favorite) => [
          ...(favorite.genreNames ?? []),
          ...(favorite.genreKeys ?? []),
        ]),
      ),
      actorKeys: normalizeMatchNames(
        favorites.flatMap((favorite) => [
          ...(favorite.actorNames ?? []),
          ...(favorite.actorKeys ?? []),
        ]),
      ),
      directorKeys: normalizeMatchNames(
        favorites.flatMap((favorite) => [
          ...(favorite.directorNames ?? []),
          ...(favorite.directorKeys ?? []),
        ]),
      ),
      years: this.unique(years),
    };
  }

  // Calcule les scores par critère et le score global entre deux profils.
  private calculateMatch(
    preferences: Preferences,
    profile: MatchProfile,
  ): MatchResult {
    const genreScore = this.setSimilarity(
      preferences.genreKeys,
      profile.genreKeys ?? [],
    );

    const actorScore = this.setSimilarity(
      preferences.actorKeys,
      profile.actorKeys ?? [],
    );

    const directorScore = this.setSimilarity(
      preferences.directorKeys,
      profile.directorKeys ?? [],
    );

    const yearScore = this.yearSimilarity(
      preferences.years,
      profile.years ?? [],
    );

    const score =
      genreScore * 0.3 +
      actorScore * 0.3 +
      directorScore * 0.2 +
      yearScore * 0.2;

    return {
      profile,
      genreScore,
      actorScore,
      directorScore,
      yearScore,
      score: Math.round(score * 10) / 10,
    };
  }

  // Compare deux listes de noms  : éléments communs / éléments distincts.
  private setSimilarity(first: string[], second: string[]): number {
    const firstSet = new Set(first);
    const secondSet = new Set(second);
    const union = new Set([...firstSet, ...secondSet]);

    if (union.size === 0) {
      return 0;
    }

    let commonCount = 0;

    firstSet.forEach((value) => {
      if (secondSet.has(value)) {
        commonCount++;
      }
    });

    return (commonCount / union.size) * 100;
  }

  // Compare les années de sortie ; les années proches donnent une meilleure similarité.
  private yearSimilarity(first: number[], second: number[]): number {
    if (first.length === 0 || second.length === 0) {
      return 0;
    }

    // Calcule la similarité moyenne en associant chaque année à l’année la plus proche.
    const averageNearestSimilarity = (
      sourceYears: number[],
      targetYears: number[],
    ): number => {
      const total = sourceYears.reduce((sum, year) => {
        const closestSimilarity = Math.max(
          ...targetYears.map((targetYear) =>
            Math.max(0, 1 - Math.abs(year - targetYear) / 10),
          ),
        );

        return sum + closestSimilarity;
      }, 0);

      return total / sourceYears.length;
    };

    const forward = averageNearestSimilarity(first, second);
    const backward = averageNearestSimilarity(second, first);

    return ((forward + backward) / 2) * 100;
  }

  // Retire les doublons d’une liste d’années.
  private unique(values: number[]): number[] {
    return [...new Set(values)];
  }
}
