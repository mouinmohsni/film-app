import { inject, Service } from '@angular/core';
import {
  HttpClient,
  HttpHeaders,
  HttpParams,
} from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface TmdbGenre {
  id: number;
  name: string;
}

export interface TmdbCastMember {
  id: number;
  name: string;
  order: number;
}

export interface TmdbCrewMember {
  id: number;
  name: string;
  job: string;
  department: string;
}

export interface TmdbMovieCredits {
  id: number;
  cast: TmdbCastMember[];
  crew: TmdbCrewMember[];
}


export interface TmdbMovie {
  id: number;
  title: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date: string;
  vote_average: number;
  genre_ids?: number[];
}

export interface TmdbMovieResponse {
  page: number;
  results: TmdbMovie[];
  total_pages: number;
  total_results: number;
}

export interface TmdbGenreResponse {
  genres: TmdbGenre[];
}

export interface TmdbMovieDetails extends TmdbMovie {
  tagline: string;
  runtime: number | null;
  genres: TmdbGenre[];
  status: string;
  original_title: string;
  original_language: string;
}

@Service()
export class Tmdb {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = 'https://api.themoviedb.org/3';

  private readonly headers = new HttpHeaders({
    Authorization: `Bearer ${environment.tmdb.readAccessToken}`,
  });

  getPopularMovies(
    language = 'fr-FR',
    page = 1,
  ): Observable<TmdbMovieResponse> {
    const params = new HttpParams()
      .set('language', language)
      .set('page', page);

    return this.http.get<TmdbMovieResponse>(
      `${this.apiUrl}/movie/popular`,
      { headers: this.headers, params },
    );
  }

  getMovieGenres(language = 'fr-FR'): Observable<TmdbGenreResponse> {
    const params = new HttpParams().set('language', language);

    return this.http.get<TmdbGenreResponse>(
      `${this.apiUrl}/genre/movie/list`,
      { headers: this.headers, params },
    );
  }

  searchMovies(
    query: string,
    language = 'fr-FR',
    page = 1,
  ): Observable<TmdbMovieResponse> {
    const params = new HttpParams()
      .set('query', query)
      .set('language', language)
      .set('page', page);

    return this.http.get<TmdbMovieResponse>(
      `${this.apiUrl}/search/movie`,
      { headers: this.headers, params },
    );
  }

  getMoviesByGenre(
    genreId: number,
    language = 'fr-FR',
    page = 1,
  ): Observable<TmdbMovieResponse> {
    const params = new HttpParams()
      .set('with_genres', genreId)
      .set('language', language)
      .set('page', page)
      .set('sort_by', 'popularity.desc');

    return this.http.get<TmdbMovieResponse>(
      `${this.apiUrl}/discover/movie`,
      { headers: this.headers, params },
    );
  }

  getMovieCredits(
    movieId: number,
    language = 'fr-FR',
  ): Observable<TmdbMovieCredits> {
    const params = new HttpParams().set('language', language);

    return this.http.get<TmdbMovieCredits>(
      `${this.apiUrl}/movie/${movieId}/credits`,
      { headers: this.headers, params },
    );
  }


  getMovieDetails(
    movieId: number,
    language = 'fr-FR',
  ): Observable<TmdbMovieDetails> {
    const params = new HttpParams().set('language', language);

    return this.http.get<TmdbMovieDetails>(
      `${this.apiUrl}/movie/${movieId}`,
      { headers: this.headers, params },
    );
  }

  getPosterUrl(path: string | null): string | null {
    return path ? `https://image.tmdb.org/t/p/w500${path}` : null;
  }
}
