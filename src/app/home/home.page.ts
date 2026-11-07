import {
  Component,
  OnDestroy,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { firstValueFrom, Observable } from 'rxjs';
import { onAuthStateChanged } from 'firebase/auth';
import type { Unsubscribe } from 'firebase/auth';

import { Tmdb } from '../services/tmdb';
import type {
  TmdbGenre,
  TmdbMovie,
  TmdbMovieResponse,
} from '../services/tmdb';
import type { CatalogMovie } from '../services/movie.model';
import { FirebaseService } from '../services/firebase.service';

interface HomeCatalogMovie {
  movieKey: string;
  source: 'tmdb' | 'firestore';
  sourceId: string;
  id: number | string;
  title: string;
  overview: string;
  poster_path: string | null;
  release_date: string;
  vote_average: number | null;
  genreNames: string[];
  tmdbMovie?: TmdbMovie;
  manualMovie?: CatalogMovie;
}

@Component({
  selector: 'app-home',
  templateUrl: './home.page.html',
  styleUrls: ['./home.page.scss'],
  standalone: false,
})
export class HomePage implements OnInit, OnDestroy {
  private readonly tmdb = inject(Tmdb);
  private readonly firebaseService = inject(FirebaseService);

  // Films TMDB renvoyés par la recherche ou le filtre.
  movies = signal<TmdbMovie[]>([]);

  // Films ajoutés manuellement dans Firestore.
  manualMovies = signal<CatalogMovie[]>([]);
  manualMoviesLoading = signal(false);
  manualMoviesError = signal('');

  isLoading = signal(true);
  errorMessage = signal('');

  genres = signal<TmdbGenre[]>([]);
  selectedGenreId = signal<number | null>(null);
  searchQuery = signal('');

  favoriteIds = signal<Set<number | string>>(new Set());
  isAuthenticated = signal(false);

  // Fusionne les films manuels et les résultats TMDB dans un format commun.
  catalogMovies = computed<HomeCatalogMovie[]>(() => {
    const query = this.searchQuery().trim().toLocaleLowerCase('fr-FR');
    const selectedGenreId = this.selectedGenreId();

    const selectedGenre =
      selectedGenreId === null
        ? null
        : this.genres().find((genre) => genre.id === selectedGenreId)?.name;

    const manualMovies: HomeCatalogMovie[] = this.manualMovies()
      .filter(
        (movie) =>
          !query ||
          movie.title.toLocaleLowerCase('fr-FR').includes(query),
      )
      .filter((movie) => {
        if (selectedGenreId === null) {
          return true;
        }

        if (!selectedGenre) {
          return false;
        }

        return (movie.genreNames ?? []).some(
          (genreName) =>
            genreName.toLocaleLowerCase('fr-FR') ===
            selectedGenre.toLocaleLowerCase('fr-FR'),
        );
      })
      .map((movie) => ({
        movieKey: movie.movieKey,
        source: 'firestore',
        sourceId: movie.sourceId,
        id: movie.sourceId,
        title: movie.title,
        overview: movie.overview,
        poster_path: movie.posterUrl,
        release_date:
          movie.releaseDate ||
          (movie.year !== null ? String(movie.year) : ''),
        vote_average: movie.voteAverage,
        genreNames: movie.genreNames ?? [],
        manualMovie: movie,
      }));

    const tmdbMovies: HomeCatalogMovie[] = this.movies().map((movie) => ({
      movieKey: `tmdb:${movie.id}`,
      source: 'tmdb',
      sourceId: String(movie.id),
      id: movie.id,
      title: movie.title,
      overview: movie.overview,
      poster_path: movie.poster_path,
      release_date: movie.release_date,
      vote_average: movie.vote_average,
      genreNames: (movie.genre_ids ?? [])
        .map((genreId) =>
          this.genres().find((genre) => genre.id === genreId)?.name,
        )
        .filter((genreName): genreName is string => Boolean(genreName)),
      tmdbMovie: movie,
    }));

    return [...manualMovies, ...tmdbMovies];
  });

  private stopAuthListener?: Unsubscribe;

  ngOnInit(): void {
    this.loadGenres();
    this.loadMovies();

    this.stopAuthListener = onAuthStateChanged(
      this.firebaseService.auth,
      (user) => {
        this.isAuthenticated.set(!!user);

        if (user) {
          void this.loadFavorites();
        } else {
          this.favoriteIds.set(new Set());
        }
      },
    );
  }

  ionViewWillEnter(): void {
    void this.loadManualMovies();

    if (this.isAuthenticated()) {
      void this.loadFavorites();
    }
  }

  ngOnDestroy(): void {
    this.stopAuthListener?.();
  }

  loadGenres(): void {
    this.tmdb.getMovieGenres().subscribe({
      next: (response) => this.genres.set(response.genres),
      error: (error: unknown) => {
        console.error('Erreur lors du chargement des genres :', error);
      },
    });
  }

  loadMovies(): void {
    this.loadRequest(this.tmdb.getPopularMovies());
  }

  async loadManualMovies(): Promise<void> {
    this.manualMoviesLoading.set(true);
    this.manualMoviesError.set('');

    try {
      const movies = await this.firebaseService.getManualMovies();
      this.manualMovies.set(movies);
    } catch (error: unknown) {
      console.error('Erreur lors du chargement des films manuels :', error);
      this.manualMoviesError.set(
        'Impossible de récupérer les films ajoutés au catalogue.',
      );
    } finally {
      this.manualMoviesLoading.set(false);
    }
  }

  onSearchInput(event: CustomEvent<{ value?: string | null }>): void {
    const query = (event.detail.value ?? '').trim();

    this.searchQuery.set(query);
    this.selectedGenreId.set(null);

    if (!query) {
      this.loadMovies();
      return;
    }

    this.loadRequest(this.tmdb.searchMovies(query));
  }

  selectGenre(genreId: number | null): void {
    const nextGenreId = this.selectedGenreId() === genreId ? null : genreId;

    this.selectedGenreId.set(nextGenreId);
    this.searchQuery.set('');

    if (nextGenreId === null) {
      this.loadMovies();
      return;
    }

    this.loadRequest(this.tmdb.getMoviesByGenre(nextGenreId));
  }

  onGenreChange(
    event: CustomEvent<{ value?: number | string | null }>,
  ): void {
    const value = event.detail.value;

    if (value === null || value === undefined || value === 0 || value === '0') {
      this.selectGenre(null);
      return;
    }

    const genreId = Number(value);

    if (Number.isInteger(genreId)) {
      this.selectGenre(genreId);
    }
  }

  private loadRequest(request: Observable<TmdbMovieResponse>): void {
    this.isLoading.set(true);
    this.errorMessage.set('');

    request.subscribe({
      next: (response) => {
        this.movies.set(response.results);
        this.isLoading.set(false);
      },
      error: (error: unknown) => {
        console.error('Erreur lors du chargement des films TMDB :', error);
        this.errorMessage.set(
          'Impossible de charger les films TMDB. Vérifie ta connexion et réessaie.',
        );
        this.isLoading.set(false);
      },
    });
  }

  async loadFavorites(): Promise<void> {
    try {
      const favorites = await this.firebaseService.getFavorites();
      this.favoriteIds.set(new Set(favorites.map((movie) => movie.id)));
    } catch (error: unknown) {
      console.error('Erreur lors du chargement des favoris :', error);
    }
  }

  isFavorite(movieId: number | string): boolean {
    return this.favoriteIds().has(movieId);
  }

  async toggleCatalogFavorite(movie: HomeCatalogMovie): Promise<void> {
    if (movie.source === 'tmdb' && movie.tmdbMovie) {
      await this.toggleFavorite(movie.tmdbMovie);
      return;
    }

    if (
      movie.source !== 'firestore' ||
      !movie.manualMovie ||
      !this.isAuthenticated()
    ) {
      return;
    }

    const favoriteId = movie.sourceId;

    try {
      if (this.isFavorite(favoriteId)) {
        await this.firebaseService.removeFavorite(favoriteId);

        this.favoriteIds.update((currentIds) => {
          const updatedIds = new Set(currentIds);
          updatedIds.delete(favoriteId);
          return updatedIds;
        });

        return;
      }

      const wasAdded = await this.firebaseService.addManualFavorite(
        movie.manualMovie,
      );

      if (wasAdded) {
        this.favoriteIds.update((currentIds) => {
          const updatedIds = new Set(currentIds);
          updatedIds.add(favoriteId);
          return updatedIds;
        });
      }
    } catch (error: unknown) {
      console.error(
        'Erreur lors de la modification du favori manuel :',
        error,
      );
    }
  }


  // Pour l’instant, cette action ne gère que les favoris TMDB.
  async toggleFavorite(movie: TmdbMovie): Promise<void> {
    try {
      if (this.isFavorite(movie.id)) {
        await this.firebaseService.removeFavorite(movie.id);

        const updatedIds = new Set(this.favoriteIds());
        updatedIds.delete(movie.id);
        this.favoriteIds.set(updatedIds);
        return;
      }

      const [credits, details] = await Promise.all([
        firstValueFrom(this.tmdb.getMovieCredits(movie.id)),
        firstValueFrom(this.tmdb.getMovieDetails(movie.id)),
      ]);

      const actorNames = [...credits.cast]
        .sort((a, b) => a.order - b.order)
        .slice(0, 10)
        .map((actor) => actor.name);

      const directorNames = credits.crew
        .filter((member) => member.job === 'Director')
        .slice(0, 3)
        .map((director) => director.name);

      const genreNames = details.genres.map((genre) => genre.name);

      const wasAdded = await this.firebaseService.addFavorite(
        movie,
        [],
        [],
        {
          genreNames,
          actorNames,
          directorNames,
        },
      );

      if (wasAdded) {
        const updatedIds = new Set(this.favoriteIds());
        updatedIds.add(movie.id);
        this.favoriteIds.set(updatedIds);
      }
    } catch (error: unknown) {
      console.error('Erreur lors de la modification des favoris :', error);
    }
  }

  getPosterUrl(path: string | null): string | null {
    if (!path) {
      return null;
    }

    // Les affiches Firestore sont déjà des URLs complètes.
    if (path.startsWith('http://' ) || path.startsWith('https://' )) {
      return path;
    }

    return this.tmdb.getPosterUrl(path);
  }
}
