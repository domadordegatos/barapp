import { Injectable } from '@angular/core';
import { CanActivate, ActivatedRouteSnapshot, RouterStateSnapshot, Router } from '@angular/router';
import { NotificationService } from '../services/notification.service';
import { RockolaService } from '../services/rockola.service';

@Injectable({
  providedIn: 'root'
})
export class AuthGuard implements CanActivate {

  constructor(
    private router: Router,
    private notificationService: NotificationService,
    private rockolaService: RockolaService
  ) {}

// auth.guard.ts

canActivate(route: ActivatedRouteSnapshot): boolean {
  const sesion = sessionStorage.getItem('usuarioAdmin');
  if (!sesion) {
    this.router.navigate(['/']);
    return false;
  }

  const usuario = JSON.parse(sesion);
  const esMaster = usuario?.correo === this.rockolaService.CORREO_MASTER;

  if (!esMaster && usuario?.estado === false) {
    sessionStorage.removeItem('usuarioAdmin');
    this.notificationService.error('Tu cuenta esta pendiente de activacion por Super Admin.');
    this.router.navigate(['/']);
    return false;
  }

  const barEnUrl = route.paramMap.get('nombreBar');

  if (barEnUrl) {
    // NORMALIZACIÓN: Quitamos espacios y pasamos a minúsculas en ambos lados
    const barUsuarioNormalizado = usuario.nombreBar.toLowerCase().replace(/\s+/g, '');
    const barUrlNormalizado = barEnUrl.toLowerCase().replace(/\s+/g, '');

    if (barUsuarioNormalizado !== barUrlNormalizado) {
      console.error("Diferencia detectada:", barUsuarioNormalizado, "vs", barUrlNormalizado);
      this.notificationService.error('No tienes permisos para gestionar este establecimiento.');
      this.router.navigate(['/']); 
      return false;
    }
  }

  return true;
}
}