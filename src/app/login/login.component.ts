import { Component } from '@angular/core';
import { RockolaService } from '../services/rockola.service';
import { Router } from '@angular/router';

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

  constructor(private rockolaService: RockolaService, private router: Router) {}

async recuperar() {
  try {
    // Aquí el servicio envía el correo. El usuario NO ve el código en la web.
    this.userIdParaReset = await this.rockolaService.solicitarRecuperacion(this.correo);
    
    alert("Revisa tu bandeja de entrada. Te hemos enviado un código de seguridad.");
    this.pasoReset = 2; 
  } catch (error: any) {
    alert(error.message);
  }
}

async confirmarCambio() {
  try {
    await this.rockolaService.cambiarPasswordConToken(this.userIdParaReset, this.codigoReset, this.nuevaPass);
    alert("Contraseña actualizada correctamente.");
    this.olvidoModo = false;
    this.pasoReset = 1;
  } catch (error: any) {
    alert(error.message);
  }
}

// login.component.ts -> Dentro del método entrar()

async entrar() {
  try {
    const user = await this.rockolaService.loginUsuario(this.correo, this.pass);
    
    // GUARDAMOS LA SESIÓN: Guardamos el ID o el objeto completo convertido a texto
    sessionStorage.setItem('usuarioAdmin', JSON.stringify(user));
    
    alert(`Bienvenido, ${user.nombreBar}`);
    this.router.navigate(['/admin/gestion']);
  } catch (error: any) {
    alert(error.message);
  }
}
}