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


  // Initialise les données de la page et écoute l’état de connexion.

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

  // Recharge les films manuels et les favoris lorsque l’utilisateur revient sur la page.
  ionViewWillEnter(): void {
    void this.loadManualMovies();

    if (this.isAuthenticated()) {
      void this.loadFavorites();
    }
  }

  // Arrête l’écoute de l’authentification quand la page est détruite.
  ngOnDestroy(): void {
    this.stopAuthListener?.();
  }


// Récupère la liste des genres de films depuis TMDB.
  loadGenres(): void {
    this.tmdb.getMovieGenres().subscribe({
      next: (response) => this.genres.set(response.genres),
      error: (error: unknown) => {
        console.error('Erreur lors du chargement des genres :', error);
      },
    });
  }

// Charge les films populaires depuis TMDB.
  loadMovies(): void {
    this.loadRequest(this.tmdb.getPopularMovies());
  }

  // Récupère les films ajoutés manuellement.
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

  // Met à jour la recherche
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

  // Sélectionne ou désélectionne un genre et charge les films correspondants.
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

  // Traite le changement de genre effectué dans le sélecteur Ionic.
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

  // Traite le changement de genre effectué dans le sélecteur Ionic.
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

  // Récupère les identifiants des favoris de l’utilisateur connecté.
  async loadFavorites(): Promise<void> {
    try {
      const favorites = await this.firebaseService.getFavorites();
      this.favoriteIds.set(new Set(favorites.map((movie) => movie.id)));
    } catch (error: unknown) {
      console.error('Erreur lors du chargement des favoris :', error);
    }
  }

  // Indique si un film figure déjà dans la liste des favoris.
  isFavorite(movieId: number | string): boolean {
    return this.favoriteIds().has(movieId);
  }

  // Ajoute ou retire des favoris un film TMDB ou un film manuel.
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


  // Ajoute ou retire un film TMDB des favoris et met à jour les préférences de matching.
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

  // Retourne l’URL d’une affiche manuelle ou construit l’URL TMDB.
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
