import { Component, OnInit } from '@angular/core';
import { RockolaService } from '../services/rockola.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-registro-admin',
  templateUrl: './registro-admin.component.html',
  styleUrls: ['./registro-admin.component.scss']
})
export class RegistroAdminComponent implements OnInit {
  datos = { nombreBar: '', correo: '', password: '' };
  
  // Captcha
  num1 = Math.floor(Math.random() * 10);
  num2 = Math.floor(Math.random() * 10);
  captchaRespuesta: number | null = null;
  barExiste: boolean = false;
  codigoRequerido: string = '';

  constructor(private rockolaService: RockolaService, private router: Router) {}

  ngOnInit(): void {}

// registro-admin.component.ts

async revisarNombreBar() {
  const nombre = this.datos.nombreBar.trim();
  if (nombre.length >= 3) {
    const bar = await this.rockolaService.verificarExistenciaBar(nombre);
    // Si 'bar' tiene datos, significa que el bar ya existe en 'bares_activos'
    this.barExiste = !!bar; 
  } else {
    this.barExiste = false;
  }
}
  
// registro-admin.component.ts

async registrarUsuario() {
  // 1. Validación del Captcha Lógico
  if (this.captchaRespuesta !== (this.num1 + this.num2)) {
    alert("Captcha incorrecto. Por favor resuelve la suma nuevamente.");
    // Refrescamos los números del captcha para un nuevo intento
    this.num1 = Math.floor(Math.random() * 10);
    this.num2 = Math.floor(Math.random() * 10);
    this.captchaRespuesta = null;
    return;
  }

  // 2. Validación de seguridad para empleados
  // Si detectamos que el bar ya existe, el código de 4 dígitos es obligatorio
  if (this.barExiste && (!this.codigoRequerido || this.codigoRequerido.length !== 4)) {
    alert("Este bar ya está registrado. Debes ingresar el código de 4 dígitos proporcionado por el administrador del bar.");
    return;
  }

  try {
    // 3. Llamada al servicio con la nueva lógica de validación cruzada
    // Enviamos los datos básicos y el código (si es que se pidió)
    await this.rockolaService.registrarUsuarioConValidacion(this.datos, this.codigoRequerido);
    
    alert("¡Registro exitoso! Tu solicitud ha sido enviada. Por seguridad, un administrador de soporte debe activar tu cuenta para que puedas ingresar.");
    
    // 4. Redirección al Login
    this.router.navigate(['/']); 
    
  } catch (error: any) {
    // Aquí capturamos errores como "Código incorrecto" o "Falla de red"
    alert(error.message);
  }
}
}