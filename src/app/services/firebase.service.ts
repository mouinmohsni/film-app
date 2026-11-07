import { Injectable } from '@angular/core';

import { AuthService } from './auth.service';
import { firebaseAuth, firestoreDb } from './firebase-core';
import { MovieDataService } from './movie-data.service';
import type {
  FavoriteMovie,
  FavoriteMovieNames,
  MatchProfile,
  ManualMovieInput
} from './movie-data.service';
import { UserService } from './user.service';
import type { AdminUser, UserProfile } from './user.service';
import type { CatalogMovie } from './movie.model';
import type { TmdbMovie } from './tmdb';

// Préserve les imports de types déjà utilisés par les pages.
export type {
  FavoriteMovie,
  FavoriteMovieNames,
  MatchProfile,
  ManualMovieInput
} from './movie-data.service';
export type { AdminUser, UserProfile } from './user.service';

@Injectable({
  providedIn: 'root',
})
export class FirebaseService {
  // Ces propriétés sont conservées pour les pages qui les utilisent encore.
  readonly auth = firebaseAuth;
  readonly db = firestoreDb;

  constructor(
    private readonly authService: AuthService,
    private readonly userService: UserService,
    private readonly movieDataService: MovieDataService,
  ) {}

  register(
    email: string,
    password: string,
    profile: { nom: string; prenom: string; age: number },
  ) {
    return this.authService.register(email, password, profile);
  }

  login(email: string, password: string) {
    return this.authService.login(email, password);
  }

  logout(): Promise<void> {
    return this.authService.logout();
  }

  changePassword(
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    return this.authService.changePassword(currentPassword, newPassword);
  }

  getProfile(): Promise<UserProfile | null> {
    return this.userService.getProfile();
  }

  getAdminUsers(): Promise<AdminUser[]> {
    return this.userService.getAdminUsers();
  }

  setUserActive(userId: string, isActive: boolean): Promise<void> {
    return this.userService.setUserActive(userId, isActive);
  }

  async saveProfilePhoto(photoDataUrl: string): Promise<void> {
    await this.userService.saveProfilePhoto(photoDataUrl);

    // Conserve le comportement précédent : actualiser aussi
    // la photo du profil partagé si le matching est activé.
    await this.movieDataService.refreshMatchProfileSafely();
  }

  getMatchingEnabled(): Promise<boolean> {
    return this.userService.getMatchingEnabled();
  }

  setMatchingEnabled(enabled: boolean): Promise<void> {
    return this.movieDataService.setMatchingEnabled(enabled);
  }

  getManualMovies(): Promise<CatalogMovie[]> {
    return this.movieDataService.getManualMovies();
  }

  getFavorites(): Promise<FavoriteMovie[]> {
    return this.movieDataService.getFavorites();
  }

  addFavorite(
    movie: TmdbMovie,
    actorIds: number[] = [],
    directorIds: number[] = [],
    names: FavoriteMovieNames = {},
  ): Promise<boolean> {
    return this.movieDataService.addFavorite(
      movie,
      actorIds,
      directorIds,
      names,
    );
  }

  addManualFavorite(movie: CatalogMovie): Promise<boolean> {
    return this.movieDataService.addManualFavorite(movie);
  }

  removeFavorite(movieId: number |string): Promise<void> {
    return this.movieDataService.removeFavorite(movieId);
  }

  getOtherMatchProfiles(): Promise<MatchProfile[]> {
    return this.movieDataService.getOtherMatchProfiles();
  }

  addManualMovie(input: ManualMovieInput): Promise<CatalogMovie> {
    return this.movieDataService.addManualMovie(input);
  }

}
