import { Component, inject, signal } from '@angular/core';
import { FirebaseService } from '../../services/firebase.service';
import type { CatalogMovie } from '../../services/movie.model';

@Component({
  selector: 'app-movies',
  templateUrl: './movies.page.html',
  styleUrls: ['./movies.page.scss'],
  standalone: false,
})
export class MoviesPage {
  private readonly firebaseService = inject(FirebaseService);

  movies = signal<CatalogMovie[]>([]);
  isLoading = signal(false);
  errorMessage = signal('');

  // Ionic recharge la liste chaque fois qu’on ouvre cette page.
  ionViewWillEnter(): void {
    void this.loadMovies();
  }

  async loadMovies(): Promise<void> {
    this.isLoading.set(true);
    this.errorMessage.set('');

    try {
      const movies = await this.firebaseService.getManualMovies();
      this.movies.set(movies);
    } catch (error: unknown) {
      console.error('Erreur lors du chargement des films manuels :', error);
      this.errorMessage.set(
        'Impossible de charger les films. Vérifie ta connexion et les règles Firestore.',
      );
    } finally {
      this.isLoading.set(false);
    }
  }
}
