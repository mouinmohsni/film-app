import { Component, OnInit, inject, signal } from '@angular/core';
import { AlertController } from '@ionic/angular';
import { Router } from '@angular/router';

import { FirebaseService } from '../../services/firebase.service';
import type { ManualMovieInput } from '../../services/firebase.service';
import { Tmdb } from '../../services/tmdb';
import type { TmdbGenre } from '../../services/tmdb';

@Component({
  selector: 'app-add-movie',
  templateUrl: './add-movie.page.html',
  styleUrls: ['./add-movie.page.scss'],
  standalone: false,
})
export class AddMoviePage implements OnInit {
  private readonly firebaseService = inject(FirebaseService);
  private readonly alertController = inject(AlertController);
  private readonly router = inject(Router);
  private readonly tmdb = inject(Tmdb);

  genres = signal<TmdbGenre[]>([]);
  isLoadingGenres = signal(true);
  genresErrorMessage = signal('');

  selectedGenres: string[] = [];

  title = '';
  overview = '';
  posterUrl = '';
  releaseDate = '';
  year: string | number | null = '';
  voteAverage: string | number | null = '';

  // Conservé temporairement pour l’ancien champ de genres dans le HTML.
  genreNamesText = '';

  actorNamesText = '';
  directorNamesText = '';

  isSaving = false;

  ngOnInit(): void {
    this.tmdb.getMovieGenres().subscribe({
      next: (response) => {
        this.genres.set(response.genres);
        this.isLoadingGenres.set(false);
      },
      error: (error: unknown) => {
        console.error('Erreur lors du chargement des genres TMDB :', error);
        this.genresErrorMessage.set(
          'Impossible de charger les genres. Tu peux réessayer plus tard.',
        );
        this.isLoadingGenres.set(false);
      },
    });
  }

  async saveMovie(): Promise<void> {
    if (this.isSaving) {
      return;
    }

    const title = this.title.trim();

    if (!title) {
      await this.showAlert('Titre manquant', 'Saisis le titre du film.');
      return;
    }

    const yearText = String(this.year ?? '').trim();
    const releaseDate = String(this.releaseDate ?? '').trim();

    const year = yearText
      ? Number(yearText)
      : releaseDate
        ? Number(releaseDate.slice(0, 4))
        : null;

    if (
      year !== null &&
      (!Number.isInteger(year) || year < 1888 || year > 2100)
    ) {
      await this.showAlert(
        'Année invalide',
        'Saisis une année entière comprise entre 1888 et 2100.',
      );
      return;
    }

    const voteText = String(this.voteAverage ?? '').trim();
    const voteAverage = voteText ? Number(voteText) : null;

    if (
      voteAverage !== null &&
      (!Number.isFinite(voteAverage) ||
        voteAverage < 0 ||
        voteAverage > 10)
    ) {
      await this.showAlert(
        'Note invalide',
        'La note doit être comprise entre 0 et 10.',
      );
      return;
    }

    const posterUrl = this.posterUrl.trim() || null;

    if (posterUrl && !this.isValidWebUrl(posterUrl)) {
      await this.showAlert(
        'Adresse invalide',
        'L’affiche doit utiliser une adresse Web commençant par https:// ou http://.',
      );
      return;
    }

    const input: ManualMovieInput = {
      title,
      overview: this.overview.trim(),
      posterUrl,
      releaseDate,
      year,
      voteAverage,

      // Utilise les genres sélectionnés; conserve l’ancien champ en secours
      // jusqu’au remplacement de l’HTML par le sélecteur multiple.
      genreNames:
        this.selectedGenres.length > 0
          ? this.selectedGenres
          : this.parseNames(this.genreNamesText),

      actorNames: this.parseNames(this.actorNamesText),
      directorNames: this.parseNames(this.directorNamesText),
    };

    this.isSaving = true;

    try {
      await this.firebaseService.addManualMovie(input);

      await this.showAlert(
        'Film ajouté',
        'Le film a été enregistré dans le catalogue.',
      );

      await this.router.navigateByUrl('/admin/movies', {
        replaceUrl: true,
      });
    } catch (error: unknown) {
      console.error('Erreur lors de l’ajout du film :', error);

      const message =
        error instanceof Error
          ? error.message
          : 'Une erreur inconnue est survenue.';

      await this.showAlert(
        'Ajout impossible',
        `Le film n’a pas pu être enregistré. ${message}`,
      );
    } finally {
      this.isSaving = false;
    }
  }

  private parseNames(value: string): string[] {
    return [
      ...new Set(
        value
          .split(/[,\n;]/)
          .map((name) => name.trim())
          .filter((name) => name.length > 0),
      ),
    ];
  }

  private isValidWebUrl(value: string): boolean {
    try {
      const url = new URL(value);
      return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
      return false;
    }
  }

  private async showAlert(header: string, message: string): Promise<void> {
    const alert = await this.alertController.create({
      header,
      message,
      buttons: ['OK'],
    });

    await alert.present();
    await alert.onDidDismiss();
  }
}
