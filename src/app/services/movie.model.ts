export type MovieSource = 'tmdb' | 'firestore';

export interface CatalogMovie {
  // Identifiant utilisé par l’application, par exemple "tmdb:155"
  // ou "firestore:abc123".
  movieKey: string;

  source: MovieSource;
  sourceId: string;

  title: string;
  overview: string;
  posterUrl: string | null;
  releaseDate: string;
  year: number | null;
  voteAverage: number | null;

  // Noms conservés pour l’affichage.
  genreNames: string[];
  actorNames: string[];
  directorNames: string[];

  // Clés normalisées utilisées pour calculer le matching.
  genreKeys: string[];
  actorKeys: string[];
  directorKeys: string[];
}
