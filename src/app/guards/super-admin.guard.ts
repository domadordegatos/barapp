import { Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { RockolaService } from '../services/rockola.service';

@Injectable({
  providedIn: 'root'
})
export class SuperAdminGuard implements CanActivate {
  constructor(
    private rockolaService: RockolaService, 
    private router: Router
  ) {}

  canActivate(): boolean {
    // 1. Obtenemos el usuario que se guardó en el login
    const sesion = sessionStorage.getItem('usuarioAdmin');

    if (sesion) {
      const user = JSON.parse(sesion);
      
      // 2. Comparamos el correo de la sesión con tu CORREO_MASTER
      if (user.correo === this.rockolaService.CORREO_MASTER) {
        return true; // Acceso permitido
      }
    }

    // 3. Si no coincide o no hay sesión, lo mandamos al login
    alert("Acceso restringido: Solo el Super Administrador puede entrar aquí.");
    this.router.navigate(['/']);
    return false;
  }
}