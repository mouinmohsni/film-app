import {
  Component,
  OnDestroy,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { AlertController } from '@ionic/angular';
import { ActivatedRoute } from '@angular/router';
import { onAuthStateChanged } from 'firebase/auth';
import type { Unsubscribe } from 'firebase/auth';
import { firstValueFrom } from 'rxjs';

import { FirebaseService } from '../services/firebase.service';
import type { FavoriteMovie } from '../services/firebase.service';
import { Tmdb } from '../services/tmdb';
import type {
  TmdbGenre,
  TmdbMovie,
  TmdbMovieDetails,
} from '../services/tmdb';
import type { CatalogMovie } from '../services/movie.model';

interface MovieDetailView {
  id: number | string;
  movieKey: string;
  source: 'tmdb' | 'firestore';
  sourceId: string;

  title: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date: string;
  vote_average: number | null;

  tagline: string;
  runtime: number | null;
  genres: TmdbGenre[];
  original_title: string;
  original_language: string;

  tmdbDetails: TmdbMovieDetails | null;
  manualMovie?: CatalogMovie;

}

@Component({
  selector: 'app-movie-detail',
  templateUrl: './movie-detail.page.html',
  styleUrls: ['./movie-detail.page.scss'],
  standalone: false,
})
export class MovieDetailPage implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly tmdb = inject(Tmdb);
  private readonly firebaseService = inject(FirebaseService);
  private readonly alertController = inject(AlertController);

  movie = signal<MovieDetailView | null>(null);
  isLoading = signal(true);
  errorMessage = signal('');

  isAuthenticated = signal(false);
  isFavorite = signal(false);
  isFavoriteLoading = signal(true);
  isFavoriteSaving = signal(false);

  private stopAuthListener?: Unsubscribe;

  ngOnInit(): void {
    this.loadMovie();

    this.stopAuthListener = onAuthStateChanged(
      this.firebaseService.auth,
      (user) => {
        this.isAuthenticated.set(!!user);

        if (!user) {
          this.isFavorite.set(false);
          this.isFavoriteLoading.set(false);
          return;
        }

        const currentMovie = this.movie();

        if (currentMovie) {
          void this.loadFavoriteState(currentMovie);
        } else {
          this.isFavoriteLoading.set(true);
        }
      },
    );
  }

  ngOnDestroy(): void {
    this.stopAuthListener?.();
  }

  loadMovie(): void {
    const routeId = this.route.snapshot.paramMap.get('id');

    if (!routeId) {
      this.setLoadError('Identifiant de film manquant.');
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set('');

    // Les IDs TMDB sont numériques ; les IDs Firestore sont des chaînes.
    if (!/^\d+$/.test(routeId)) {
      void this.loadManualMovie(routeId);
      return;
    }

    const movieId = Number(routeId);

    if (!Number.isSafeInteger(movieId) || movieId <= 0) {
      this.setLoadError('Identifiant de film invalide.');
      return;
    }

    this.tmdb.getMovieDetails(movieId).subscribe({
      next: (details) => {
        const movie = this.mapTmdbMovie(details);
        this.movie.set(movie);
        this.isLoading.set(false);

        if (this.isAuthenticated()) {
          void this.loadFavoriteState(movie);
        } else {
          this.isFavoriteLoading.set(false);
        }
      },
      error: (error: unknown) => {
        console.error('Erreur lors du chargement du film TMDB :', error);
        this.setLoadError(
          'Impossible de charger les informations du film. Réessaie.',
        );
      },
    });
  }

  private async loadManualMovie(sourceId: string): Promise<void> {
    try {
      const manualMovies = await this.firebaseService.getManualMovies();

      const manualMovie = manualMovies.find(
        (item) =>
          item.sourceId === sourceId ||
          item.movieKey === `firestore:${sourceId}`,
      );

      if (!manualMovie) {
        this.setLoadError('Ce film manuel est introuvable dans le catalogue.');
        return;
      }

      const movie = this.mapManualMovie(manualMovie);
      this.movie.set(movie);
      this.isLoading.set(false);

      if (this.isAuthenticated()) {
        await this.loadFavoriteState(movie);
      } else {
        this.isFavoriteLoading.set(false);
      }
    } catch (error: unknown) {
      console.error(
        'Erreur lors du chargement du film manuel Firestore :',
        error,
      );
      this.setLoadError(
        'Impossible de charger ce film depuis Firestore. Réessaie.',
      );
    }
  }

  private mapTmdbMovie(details: TmdbMovieDetails): MovieDetailView {
    return {
      id: details.id,
      movieKey: `tmdb:${details.id}`,
      source: 'tmdb',
      sourceId: String(details.id),

      title: details.title,
      overview: details.overview ?? '',
      poster_path: details.poster_path,
      backdrop_path: details.backdrop_path,
      release_date: details.release_date ?? '',
      vote_average: details.vote_average ?? null,

      tagline: details.tagline ?? '',
      runtime: details.runtime ?? null,
      genres: details.genres ?? [],
      original_title: details.original_title ?? '',
      original_language: details.original_language ?? '',

      tmdbDetails: details,
    };
  }

  private mapManualMovie(movie: CatalogMovie): MovieDetailView {
    return {
      id: movie.sourceId,
      movieKey: movie.movieKey,
      source: 'firestore',
      sourceId: movie.sourceId,

      title: movie.title,
      overview: movie.overview ?? '',
      poster_path: movie.posterUrl,
      backdrop_path: movie.posterUrl,
      manualMovie: movie,


      release_date:
        movie.releaseDate ||
        (movie.year !== null ? String(movie.year) : ''),
      vote_average: movie.voteAverage,

      tagline: '',
      runtime: null,
      genres: (movie.genreNames ?? []).map((name, index) => ({
        id: index,
        name,
      })),
      original_title: '',
      original_language: '',

      tmdbDetails: null,
    };
  }

  async loadFavoriteState(movie: MovieDetailView): Promise<void> {
    this.isFavoriteLoading.set(true);

    try {
      const favorites = await this.firebaseService.getFavorites();
      this.isFavorite.set(
        favorites.some((favorite) => this.isSameFavorite(favorite, movie)),
      );
    } catch (error: unknown) {
      console.error('Erreur lors de la vérification du favori :', error);
    } finally {
      this.isFavoriteLoading.set(false);
    }
  }

  private isSameFavorite(
    favorite: FavoriteMovie,
    movie: MovieDetailView,
  ): boolean {
    if (favorite.movieKey) {
      return favorite.movieKey === movie.movieKey;
    }

    // Les anciens favoris sans source sont considérés comme TMDB.
    const favoriteSource = favorite.source ?? 'tmdb';
    const favoriteSourceId = favorite.sourceId ?? String(favorite.id);

    return (
      favoriteSource === movie.source &&
      favoriteSourceId === movie.sourceId
    );
  }

  async toggleFavorite(movie: MovieDetailView): Promise<void> {
    if (!this.isAuthenticated() || this.isFavoriteSaving()) {
      return;
    }

    this.isFavoriteSaving.set(true);

    try {
      if (this.isFavorite()) {
        // sourceId est l’ID du document Firestore ou l’ID TMDB sous forme texte.
        await this.firebaseService.removeFavorite(movie.sourceId);
        this.isFavorite.set(false);
        return;
      }

      if (movie.source === 'firestore') {
        if (!movie.manualMovie) {
          throw new Error('Les données du film manuel sont introuvables.');
        }

        const wasAdded = await this.firebaseService.addManualFavorite(
          movie.manualMovie,
        );

        if (wasAdded) {
          this.isFavorite.set(true);
        }

        return;
      }

      if (!movie.tmdbDetails) {
        throw new Error('Les détails TMDB du film sont introuvables.');
      }

      const details = movie.tmdbDetails;
      const credits = await firstValueFrom(
        this.tmdb.getMovieCredits(details.id),
      );

      const topActors = [...credits.cast]
        .sort((a, b) => a.order - b.order)
        .slice(0, 10);

      const directors = credits.crew
        .filter((member) => member.job === 'Director')
        .slice(0, 3);

      const movieForFavorite: TmdbMovie = {
        id: details.id,
        title: details.title,
        overview: details.overview,
        poster_path: details.poster_path,
        backdrop_path: details.backdrop_path,
        release_date: details.release_date,
        vote_average: details.vote_average,
        genre_ids: details.genres.map((genre) => genre.id),
      };

      const wasAdded = await this.firebaseService.addFavorite(
        movieForFavorite,
        [],
        [],
        {
          genreNames: details.genres.map((genre) => genre.name),
          actorNames: topActors.map((actor) => actor.name),
          directorNames: directors.map((director) => director.name),
        },
      );

      if (wasAdded) {
        this.isFavorite.set(true);
      }
    } catch (error: unknown) {
      console.error('Erreur lors de la modification du favori :', error);
    } finally {
      this.isFavoriteSaving.set(false);
    }
  }

  getImageUrl(path: string | null, size = 'w500'): string | null {
    if (!path) {
      return null;
    }

    // Une URL Firestore est déjà complète.
    if (path.startsWith('http://' ) || path.startsWith('https://' )) {
      return path;
    }

    return `https://image.tmdb.org/t/p/${size}${path}`;
  }

  private setLoadError(message: string): void {
    this.errorMessage.set(message);
    this.isLoading.set(false);
    this.isFavoriteLoading.set(false);
  }

  private async showAlert(header: string, message: string): Promise<void> {
    const alert = await this.alertController.create({
      header,
      message,
      buttons: ['OK'],
    });

    await alert.present();
  }
}
