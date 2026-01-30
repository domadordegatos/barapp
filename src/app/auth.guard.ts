import { Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';

@Injectable({
  providedIn: 'root'
})
export class AuthGuard implements CanActivate {

  constructor(private router: Router) {}

  canActivate(): boolean {
    // Verificamos si existe un usuario en el almacenamiento local (sessionStorage)
    const usuarioLogueado = sessionStorage.getItem('usuarioAdmin');

    if (usuarioLogueado) {
      return true; // Puede pasar
    } else {
      // Si no hay sesión, lo mandamos al login (ruta raíz)
      alert("Acceso denegado. Por favor, inicia sesión.");
      this.router.navigate(['/']);
      return false;
    }
  }
}