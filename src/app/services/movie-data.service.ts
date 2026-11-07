import { Injectable } from '@angular/core';

// Fonctions Firestore utilisées pour lire, créer, modifier et supprimer des documents.
import {
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';

// inportant l'instance de la base
import { firebaseAuth, firestoreDb } from './firebase-core';

import type { CatalogMovie, MovieSource } from './movie.model';

// Fonction qui transforme les noms en clés comparables pour le matching.
import { normalizeMatchNames } from './movie-normalization';

import type { TmdbMovie } from './tmdb';

// Services pour récupérer le profil .
import { UserService } from './user.service';
import type { UserProfile } from './user.service';

/**
 * Représente un film enregistré dans les favoris Firestore.
 *
 * Les champs d’identification distinguent la source du film :
 * TMDB ou film ajouté manuellement dans Firestore.
 */
export interface FavoriteMovie {
  // Identifiant du film : numérique pour TMDB, texte pour Firestore.
  id: number | string;

  title: string;
  posterPath: string | null;
  releaseDate: string;
  voteAverage: number;

  // Source et identifiants servant à retrouver le film d’origine.
  source?: MovieSource;
  sourceId?: string;
  movieKey?: string;

  genreNames?: string[];
  actorNames?: string[];
  directorNames?: string[];

  genreKeys?: string[];
  actorKeys?: string[];
  directorKeys?: string[];
}

/**
 * Noms facultatifs transmis lors de l’ajout d’un film TMDB aux favoris.
 */
export interface FavoriteMovieNames {
  genreNames?: readonly string[];
  actorNames?: readonly string[];
  directorNames?: readonly string[];
}

/**
 * Données utilisées pour comparer les préférences
 */
export interface MatchProfile {
  userId: string;
  nom: string;
  prenom: string;
  photoDataUrl?: string;
  genreKeys: string[];
  actorKeys: string[];
  directorKeys: string[];
  years: number[];
  matchingEnabled: boolean;
}

/**
 * Informations fournies par le formulaire d’ajout d’un film manuel.
 */
export interface ManualMovieInput {
  title: string;
  overview: string;
  posterUrl: string | null;
  releaseDate: string;
  year: number | null;
  voteAverage: number | null;
  genreNames: string[];
  actorNames: string[];
  directorNames: string[];
}

@Injectable({
  providedIn: 'root',
})
export class MovieDataService {
  constructor(private readonly userService: UserService) {}

  /**
   * Récupère l’identifiant l’utilisateur connecté.
   */
  private getCurrentUserId(): string {
    const userId = firebaseAuth.currentUser?.uid;

    if (!userId) {
      throw new Error('Tu dois être connecté pour accéder à ces données.');
    }

    return userId;
  }

  /**
   * Récupère tous les films manuels de la collection "movies".
   */
  async getManualMovies(): Promise<CatalogMovie[]> {
    const moviesRef = collection(firestoreDb, 'movies');
    const snapshot = await getDocs(moviesRef);

    // Convertit chaque document Firestore en CatalogMovie.
    return snapshot.docs
      .map((movieDoc) => {
        const data = movieDoc.data() as Partial<CatalogMovie>;

        return {
          movieKey: data.movieKey ?? `firestore:${movieDoc.id}`,
          source: 'firestore' as const,
          sourceId: data.sourceId ?? movieDoc.id,
          title: data.title ?? '',
          overview: data.overview ?? '',
          posterUrl: data.posterUrl ?? null,
          releaseDate: data.releaseDate ?? '',
          year: data.year ?? null,
          voteAverage: data.voteAverage ?? null,
          genreNames: data.genreNames ?? [],
          actorNames: data.actorNames ?? [],
          directorNames: data.directorNames ?? [],
          genreKeys: data.genreKeys ?? [],
          actorKeys: data.actorKeys ?? [],
          directorKeys: data.directorKeys ?? [],
        };
      })
      // Trie les films par titre
      .sort((a, b) => a.title.localeCompare(b.title, 'fr'));
  }

  /**
   * Récupère les favoris de l’utilisateur connecté.
   */
  async getFavorites(): Promise<FavoriteMovie[]> {
    const userId = this.getCurrentUserId();

    // Les favoris de chaque utilisateur sont rangés dans
    // users/{userId}/favorites.
    const favoritesRef = collection(
      firestoreDb,
      'users',
      userId,
      'favorites',
    );
    const snapshot = await getDocs(favoritesRef);

    // Transforme les documents Firestore en objets FavoriteMovie.
    return snapshot.docs.map((favoriteDoc) => {
      const data = favoriteDoc.data() as Omit<FavoriteMovie, 'id'>;
      const source: MovieSource = data.source ?? 'tmdb';
      const sourceId = data.sourceId ?? favoriteDoc.id;
      const numericId = Number(sourceId);
      const id: FavoriteMovie['id'] =
        source === 'tmdb' && Number.isInteger(numericId)
          ? numericId
          : sourceId;

      return {
        ...data,
        id,
        source,
        sourceId,
        // Reconstitue movieKey si un ancien document ne le possède pas.
        movieKey: data.movieKey || `${source}:${sourceId}`,
      };
    });
  }

  /**
   * Ajoute un film TMDB aux favoris de l’utilisateur connecté.
   *
   * Retourne true si le favori a été ajouté, false s’il existait déjà.
   */
  async addFavorite(
    movie: TmdbMovie,
    // Paramètres conservés pour rester compatibles avec les anciens appels.
    // Ils ne sont pas enregistrés dans Firestore.
    _legacyActorIds: number[] = [],
    _legacyDirectorIds: number[] = [],
    names: FavoriteMovieNames = {},
  ): Promise<boolean> {
    const userId = this.getCurrentUserId();
    const sourceId = String(movie.id);

    // Le document favori est identifié par l’ID du film TMDB.
    const favoriteRef = doc(
      firestoreDb,
      'users',
      userId,
      'favorites',
      sourceId,
    );

    // Empêche de créer une deuxième fois le même favori.
    const existingFavorite = await getDoc(favoriteRef);

    if (existingFavorite.exists()) {
      return false;
    }

    const genreNames = this.cleanDisplayNames(names.genreNames);
    const actorNames = this.cleanDisplayNames(names.actorNames);
    const directorNames = this.cleanDisplayNames(names.directorNames);

    // Enregistre les informations du film et ses noms normalisés.
    await setDoc(favoriteRef, {
      source: 'tmdb',
      sourceId,
      movieKey: `tmdb:${sourceId}`,

      title: movie.title,
      posterPath: movie.poster_path,
      releaseDate: movie.release_date || '',
      voteAverage: movie.vote_average,

      genreNames,
      actorNames,
      directorNames,

      // Les clés normalisées facilitent la comparaison dans le matching.
      genreKeys: normalizeMatchNames(genreNames),
      actorKeys: normalizeMatchNames(actorNames),
      directorKeys: normalizeMatchNames(directorNames),
    });

    // Si le matching est actif, met à jour le profil partagé
    // à partir des favoris les plus récents.
    await this.refreshMatchProfileSafely();

    return true;
  }

  /**
   * Supprime un favori à partir de son identifiant de document.
   */
  async removeFavorite(movieId: number | String): Promise<void> {
    const userId = this.getCurrentUserId();

    const favoriteRef = doc(
      firestoreDb,
      'users',
      userId,
      'favorites',
      String(movieId),
    );

    await deleteDoc(favoriteRef);

    // Actualise les données utilisées par le matching après le retrait.
    await this.refreshMatchProfileSafely();
  }

  /**
   * Active ou désactive le partage des préférences pour le matching.
   */
  async setMatchingEnabled(enabled: boolean): Promise<void> {
    const userId = this.getCurrentUserId();
    const userRef = doc(firestoreDb, 'users', userId);
    const matchProfileRef = doc(firestoreDb, 'matchProfiles', userId);

    // Lorsqu’on désactive le matching, le résumé partagé est supprimé.
    if (!enabled) {
      await deleteDoc(matchProfileRef);
      await updateDoc(userRef, { matchingEnabled: false });
      return;
    }

    // Récupère le profil nécessaire pour publier les données de matching.
    const profile = await this.userService.getProfile();

    if (!profile) {
      throw new Error('PROFILE_NOT_FOUND');
    }

    // Retire d’anciens champs numériques qui ne sont plus utilisés.
    await this.removeLegacyFavoriteIds();

    // Les préférences ne sont partagées que si au moins trois films
    // sont présents dans les favoris.
    const favorites = await this.getFavorites();

    if (favorites.length < 3) {
      throw new Error('MATCHING_REQUIRES_THREE_FAVORITES');
    }

    // Enregistre d’abord la préférence de l’utilisateur.
    await updateDoc(userRef, { matchingEnabled: true });

    try {
      // Crée ou actualise le résumé partagé pour le matching.
      await this.publishMatchProfile(profile, favorites);
    } catch (error: unknown) {
      // Si la publication échoue, essaie de rétablir l’état précédent :
      // supprime le résumé partiel et désactive le matching.
      try {
        await deleteDoc(matchProfileRef);
      } catch (cleanupError: unknown) {
        console.error(
          'Échec du nettoyage du profil de matching :',
          cleanupError,
        );
      }

      try {
        await updateDoc(userRef, { matchingEnabled: false });
      } catch (rollbackError: unknown) {
        console.error(
          'Échec du retour à matchingEnabled=false :',
          rollbackError,
        );
      }

      // Propage l’erreur pour que la page appelante puisse la traiter.
      throw error;
    }
  }

  /**
   * Supprime les anciens tableaux d’identifiants numériques
   * dans les documents favoris, s’ils existent.
   */
  private async removeLegacyFavoriteIds(): Promise<void> {
    const userId = this.getCurrentUserId();
    const favoritesRef = collection(
      firestoreDb,
      'users',
      userId,
      'favorites',
    );
    const snapshot = await getDocs(favoritesRef);

    // Traite les documents favoris en parallèle.
    await Promise.all(
      snapshot.docs.map(async (favoriteDoc) => {
        const data = favoriteDoc.data();

        // Ne contient que les champs anciens qui seront supprimés.
        const fieldsToDelete: {
          genreIds?: ReturnType<typeof deleteField>;
          actorIds?: ReturnType<typeof deleteField>;
          directorIds?: ReturnType<typeof deleteField>;
        } = {};

        if ('genreIds' in data) {
          fieldsToDelete.genreIds = deleteField();
        }

        if ('actorIds' in data) {
          fieldsToDelete.actorIds = deleteField();
        }

        if ('directorIds' in data) {
          fieldsToDelete.directorIds = deleteField();
        }

        // Modifie le document uniquement si au moins un ancien champ existe.
        if (Object.keys(fieldsToDelete).length > 0) {
          await updateDoc(favoriteDoc.ref, fieldsToDelete);
        }
      }),
    );
  }

  /**
   * Construit et enregistre le profil partagé de matching.
   */
  private async publishMatchProfile(
    profile: UserProfile,
    favorites: FavoriteMovie[],
  ): Promise<void> {
    const userId = this.getCurrentUserId();
    const matchProfileRef = doc(firestoreDb, 'matchProfiles', userId);

    const genreKeys = normalizeMatchNames(
      favorites.flatMap((favorite) => [
        ...(favorite.genreNames ?? []),
        ...(favorite.genreKeys ?? []),
      ]),
    ).slice(0, 20);

    const actorKeys = normalizeMatchNames(
      favorites.flatMap((favorite) => [
        ...(favorite.actorNames ?? []),
        ...(favorite.actorKeys ?? []),
      ]),
    ).slice(0, 100);

    const directorKeys = normalizeMatchNames(
      favorites.flatMap((favorite) => [
        ...(favorite.directorNames ?? []),
        ...(favorite.directorKeys ?? []),
      ]),
    ).slice(0, 50);

    // Extrait les années de sortie des films favoris.
    const years = [
      ...new Set(
        favorites
          .map((favorite) => Number(favorite.releaseDate.slice(0, 4)))
          .filter(
            (year) =>
              Number.isInteger(year) && year >= 1888 && year <= 2100,
          ),
      ),
    ].slice(0, 50);

    // Enregistre le résumé dans matchProfiles/{userId}.
    await setDoc(matchProfileRef, {
      nom: profile.nom,
      prenom: profile.prenom,
      genreKeys,
      actorKeys,
      directorKeys,
      years,
      matchingEnabled: true,

      // La photo n’est ajoutée au profil partagé que si elle existe.
      ...(profile.photoDataUrl
        ? { photoDataUrl: profile.photoDataUrl }
        : {}),
    });
  }

  /**
   * Met à jour le profil de matching après un changement de favori
   * ou d’une donnée liée au profil.
   */
  private async syncCurrentMatchProfile(): Promise<void> {
    const profile = await this.userService.getProfile();


    if (!profile || profile.matchingEnabled !== true) {
      return;
    }

    const favorites = await this.getFavorites();
    const userId = this.getCurrentUserId();
    const matchProfileRef = doc(firestoreDb, 'matchProfiles', userId);

    // S’il reste moins de trois favoris, le résumé partagé est supprimé.
    if (favorites.length < 3) {
      await deleteDoc(matchProfileRef);
      return;
    }

    // Sinon, le résumé est recalculé avec la liste actuelle des favoris.
    await this.publishMatchProfile(profile, favorites);
  }


  async refreshMatchProfileSafely(): Promise<void> {
    try {
      await this.syncCurrentMatchProfile();
    } catch (error: unknown) {
      // L’erreur est journalisée ; elle n’annule pas l’ajout ou
      // la suppression du favori qui vient d’être effectué.
      console.error(
        'Erreur lors de la synchronisation du profil Match :',
        error,
      );
    }
  }

  /**
   * Récupère les profils des autres utilisateurs
   * qui participent actuellement au matching.
   */
  async getOtherMatchProfiles(): Promise<MatchProfile[]> {
    const currentUserId = this.getCurrentUserId();

    // Ne demande que les profils dont le matching est activé.
    const profilesQuery = query(
      collection(firestoreDb, 'matchProfiles'),
      where('matchingEnabled', '==', true),
    );

    const snapshot = await getDocs(profilesQuery);

    return snapshot.docs
      // Retire le profil de l’utilisateur actuellement connecté.
      .filter((profileDoc) => profileDoc.id !== currentUserId)
      .map((profileDoc) => ({
        userId: profileDoc.id,
        ...(profileDoc.data() as Omit<MatchProfile, 'userId'>),
      }));
  }

  /**
   * Nettoie une liste de noms : enlève les espaces inutiles,
   * supprime les valeurs vides et élimine les doublons.
   */
  private cleanDisplayNames(names: readonly string[] | undefined): string[] {
    return [
      ...new Set(
        (names ?? [])
          .map((name) => name.trim())
          .filter((name) => name.length > 0),
      ),
    ];
  }

  /**
   * Valide les données d’un film manuel, puis l’enregistre
   * dans la collection publique "movies".
   */
  async addManualMovie(input: ManualMovieInput): Promise<CatalogMovie> {
    const profile = await this.userService.getProfile();

    // Seul un compte actif ayant le rôle admin peut ajouter un film.
    if (profile?.role !== 'admin' || profile.isActive !== true) {
      throw new Error('ADMIN_REQUIRED');
    }

    // Nettoie les champs textuels reçus du formulaire.
    const title = input.title.trim();
    const overview = input.overview.trim();
    const posterUrl = input.posterUrl?.trim() || null;
    const releaseDate = input.releaseDate.trim();
    const year = input.year;
    const voteAverage = input.voteAverage;

    // Vérifie le titre et sa longueur.
    if (!title || title.length > 200) {
      throw new Error('Le titre est obligatoire et doit faire au plus 200 caractères.');
    }

    // Limite la taille du synopsis.
    if (overview.length > 5000) {
      throw new Error('Le résumé ne doit pas dépasser 5000 caractères.');
    }

    if (posterUrl && posterUrl.length > 2000) {
      throw new Error('L’adresse de l’affiche est trop longue.');
    }

    if (releaseDate.length > 20) {
      throw new Error('La date de sortie ne doit pas dépasser 20 caractères.');
    }

    // Vérifie que l’année est une année entière dans l’intervalle prévu.
    if (
      year !== null &&
      (!Number.isInteger(year) || year < 1888 || year > 2100)
    ) {
      throw new Error('L’année doit être comprise entre 1888 et 2100.');
    }

    if (
      voteAverage !== null &&
      (typeof voteAverage !== 'number' ||
        voteAverage < 0 ||
        voteAverage > 10)
    ) {
      throw new Error('La note doit être comprise entre 0 et 10.');
    }

    // limite le nombre de genres, acteurs et réalisateurs.
    const genreNames = this.cleanDisplayNames(input.genreNames).slice(0, 20);
    const actorNames = this.cleanDisplayNames(input.actorNames).slice(0, 30);
    const directorNames = this.cleanDisplayNames(input.directorNames).slice(0, 10);

    // Demande à Firestore de générer un ID unique pour le nouveau film.
    const movieRef = doc(collection(firestoreDb, 'movies'));


    const movie: CatalogMovie = {
      movieKey: `firestore:${movieRef.id}`,
      source: 'firestore',
      sourceId: movieRef.id,
      title,
      overview,
      posterUrl,
      releaseDate,
      year,
      voteAverage,
      genreNames,
      actorNames,
      directorNames,
      genreKeys: normalizeMatchNames(genreNames),
      actorKeys: normalizeMatchNames(actorNames),
      directorKeys: normalizeMatchNames(directorNames),
    };

    // Enregistre le film dans la collection "movies".
    await setDoc(movieRef, movie);

    // Retourne le film créé afin que la page appelante puisse l’utiliser.
    return movie;
  }

  /**
   * Ajoute un film manuel aux favoris de l’utilisateur connecté.
   *
   * Retourne true si le film a été ajouté,
   * ou false s’il était déjà présent.
   */
  async addManualFavorite(movie: CatalogMovie): Promise<boolean> {
    // Vérifie que les données reçues correspondent bien à un film Firestore.
    if (movie.source !== 'firestore') {
      throw new Error('Ce film n’est pas un film manuel.');
    }

    const userId = this.getCurrentUserId();
    const sourceId = movie.sourceId;

    // L’ID du document favori est le même que l’ID du film manuel.
    const favoriteRef = doc(
      firestoreDb,
      'users',
      userId,
      'favorites',
      sourceId,
    );

    // Empêche l’ajout en double.
    const existingFavorite = await getDoc(favoriteRef);

    if (existingFavorite.exists()) {
      return false;
    }

    // Nettoie les noms associés au film avant l’écriture.
    const genreNames = this.cleanDisplayNames(movie.genreNames);
    const actorNames = this.cleanDisplayNames(movie.actorNames);
    const directorNames = this.cleanDisplayNames(movie.directorNames);


    await setDoc(favoriteRef, {
      source: 'firestore',
      sourceId,
      movieKey: movie.movieKey,

      title: movie.title,
      posterPath: movie.posterUrl,
      releaseDate:
        movie.releaseDate ||
        (movie.year !== null ? String(movie.year) : ''),
      voteAverage: movie.voteAverage ?? 0,

      genreNames,
      actorNames,
      directorNames,

      genreKeys:
        movie.genreKeys.length > 0
          ? movie.genreKeys
          : normalizeMatchNames(genreNames),
      actorKeys:
        movie.actorKeys.length > 0
          ? movie.actorKeys
          : normalizeMatchNames(actorNames),
      directorKeys:
        movie.directorKeys.length > 0
          ? movie.directorKeys
          : normalizeMatchNames(directorNames),
    });

    // Actualise le profil de matching si la participation est activée.
    await this.refreshMatchProfileSafely();

    return true;
  }
}
