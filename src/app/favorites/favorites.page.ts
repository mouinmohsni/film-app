import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { onAuthStateChanged } from 'firebase/auth';
import type { Unsubscribe } from 'firebase/auth';
import {
  FavoriteMovie,
  FirebaseService,
} from '../services/firebase.service';

@Component({
  selector: 'app-favorites',
  templateUrl: './favorites.page.html',
  styleUrls: ['./favorites.page.scss'],
  standalone: false,
})
export class FavoritesPage implements OnInit, OnDestroy {
  private readonly firebaseService = inject(FirebaseService);

  favorites = signal<FavoriteMovie[]>([]);
  isLoading = signal(true);
  errorMessage = signal('');
  isAuthenticated = signal(false);

  private stopAuthListener?: Unsubscribe;

  ngOnInit(): void {
    this.stopAuthListener = onAuthStateChanged(
      this.firebaseService.auth,
      (user) => {
        this.isAuthenticated.set(!!user);

        if (user) {
          void this.loadFavorites();
        } else {
          this.favorites.set([]);
          this.isLoading.set(false);
        }
      },
    );
  }

  ionViewWillEnter(): void {
    // Actualise la liste lorsque l’utilisateur revient sur cette page.
    if (this.isAuthenticated()) {
      void this.loadFavorites();
    }
  }

  ngOnDestroy(): void {
    this.stopAuthListener?.();
  }

  async loadFavorites(): Promise<void> {
    this.isLoading.set(true);
    this.errorMessage.set('');

    try {
      const favorites = await this.firebaseService.getFavorites();
      this.favorites.set(favorites);
    } catch (error: unknown) {
      console.error('Erreur lors du chargement des favoris :', error);
      this.errorMessage.set('Impossible de charger tes favoris. Réessaie.');
    } finally {
      this.isLoading.set(false);
    }
  }

  async removeFavorite(movieId: number | string): Promise<void> {
    try {
      await this.firebaseService.removeFavorite(movieId);
      this.favorites.update((movies) =>
        movies.filter((movie) => movie.id !== movieId),
      );
    } catch (error: unknown) {
      console.error('Erreur lors du retrait du favori :', error);
      this.errorMessage.set('Impossible de retirer ce film des favoris.');
    }
  }

  getPosterUrl(path: string | null): string | null {
    if (!path) {
      return null;
    }

    // Les affiches manuelles sont déjà des URL complètes.
    if (path.startsWith('http://' ) || path.startsWith('https://' )) {
      return path;
    }

    // Les affiches TMDB sont des chemins, par exemple /abc.jpg.
    return `https://image.tmdb.org/t/p/w500${path}`;
  }

}
