import { Component } from '@angular/core';
import { RockolaService } from '../../services/rockola.service';
import { Router } from '@angular/router';
import { NotificationService } from '../../services/notification.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss']
})
export class LoginComponent {
  correo: string = '';
  pass: string = '';
  olvidoModo: boolean = false; // Para alternar entre login y recuperación
  userIdParaReset: string = '';
  codigoReset: string = '';
  nuevaPass: string = '';
  pasoReset: number = 1; // 1: Pedir correo, 2: Ingresar código y nueva pass

  constructor(
    private rockolaService: RockolaService,
    private router: Router,
    private notificationService: NotificationService
  ) {}

async recuperar() {
  try {
    // Aquí el servicio envía el correo. El usuario NO ve el código en la web.
    this.userIdParaReset = await this.rockolaService.solicitarRecuperacion(this.correo);
    
    this.notificationService.success('Revisa tu bandeja de entrada. Te hemos enviado un código de seguridad.');
    this.pasoReset = 2; 
  } catch (error: any) {
    this.notificationService.error(error.message);
  }
}

async confirmarCambio() {
  try {
    await this.rockolaService.cambiarPasswordConToken(this.userIdParaReset, this.codigoReset, this.nuevaPass);
    this.notificationService.success('Contraseña actualizada correctamente.');
    this.olvidoModo = false;
    this.pasoReset = 1;
  } catch (error: any) {
    this.notificationService.error(error.message);
  }
}

// login.component.ts

async entrar() {
  try {
    const user = await this.rockolaService.loginUsuario(this.correo, this.pass);
    sessionStorage.setItem('usuarioAdmin', JSON.stringify(user));

    if (user.correo === this.rockolaService.CORREO_MASTER) {
      this.router.navigate(['/super-admin-panel']);
    } else {
      // 1. Limpiamos el nombre para la URL: "La Chula" -> "lachula"
      const nombreUrl = user.nombreBar.toLowerCase().trim().replace(/\s+/g, '');
      
      // 2. Navegamos a la ruta exacta del Routing: :nombreBar/admin/gestion
      this.router.navigate([nombreUrl, 'admin', 'gestion']);
    }
  } catch (e: any) {
    this.notificationService.error(e.message);
  }
}


}