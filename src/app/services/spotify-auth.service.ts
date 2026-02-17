import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable, of, throwError, map } from 'rxjs';
import { catchError, switchMap, tap } from 'rxjs/operators';

@Injectable({ providedIn: 'root' })
export class SpotifyService {
  private clientId = '52e64a5657f14c01853d856b405c4579';
  private clientSecret = 'de6b8276dc6745b1b5eae8f23f86ba6c';
  private tokenUrl = 'https://accounts.spotify.com/api/token';
  private apiUrl = 'https://api.spotify.com/v1';

  constructor(private http: HttpClient) {}

  // Obtiene el token guardado o solicita uno nuevo
  private getAccessToken(): Observable<string> {
    const token = localStorage.getItem('spotify_token');
    if (token) return of(token);

    return this.renovarToken();
  }

  // Petición real a Spotify para obtener el token
  private renovarToken(): Observable<string> {
    const body = new HttpParams().set('grant_type', 'client_credentials');
    const authHeader = btoa(`${this.clientId}:${this.clientSecret}`);
    const headers = new HttpHeaders({
      'Authorization': `Basic ${authHeader}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    });

    return this.http.post<any>(this.tokenUrl, body.toString(), { headers }).pipe(
      tap(res => localStorage.setItem('spotify_token', res.access_token)),
      switchMap(res => of(res.access_token))
    );
  }

buscarTracks(termino: string): Observable<any> {
  return this.getAccessToken().pipe(
    switchMap(token => {
      const headers = new HttpHeaders({ 'Authorization': `Bearer ${token}` });
      const url = `${this.apiUrl}/search?q=${encodeURIComponent(termino)}&type=track&limit=10`;
      
      return this.http.get<any>(url, { headers }).pipe(
        map(res => res.tracks.items),
        catchError(err => {
          if (err.status === 401) {
            localStorage.removeItem('spotify_token'); // Borramos el token caducado
            // Reintentamos la búsqueda una vez más (esto forzará a renovarToken)
            return this.buscarTracks(termino);
          }
          return throwError(() => err);
        })
      );
    })
  );
}
}