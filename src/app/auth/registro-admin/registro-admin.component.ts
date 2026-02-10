import { Component, OnInit } from '@angular/core';
import { RockolaService } from '../../services/rockola.service';
import { Router } from '@angular/router';
// IMPORTANTE: Agregamos la importación que faltaba
import { firstValueFrom } from 'rxjs'; 

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

  async revisarNombreBar() {
    const nombre = this.datos.nombreBar.trim(); 
    
    if (nombre.length >= 3) {
      try {
        // CORRECCIÓN: Usamos el servicio en lugar de acceder a firestore directamente
        // Esto evita el error "La propiedad firestore no existe"
        const existe = await this.rockolaService.verificarSiAdminExiste(nombre);
        this.barExiste = existe; 
      } catch (error) {
        console.error("Error al verificar nombre:", error);
        this.barExiste = false;
      }
    } else {
      this.barExiste = false;
    }
  }

  async registrarUsuario() {
    // 1. Validación del Captcha Lógico
    if (this.captchaRespuesta !== (this.num1 + this.num2)) {
      alert("Captcha incorrecto. Por favor resuelve la suma nuevamente.");
      this.num1 = Math.floor(Math.random() * 10);
      this.num2 = Math.floor(Math.random() * 10);
      this.captchaRespuesta = null;
      return;
    }

    // 2. Validación de seguridad para empleados
    if (this.barExiste && (!this.codigoRequerido || this.codigoRequerido.length !== 4)) {
      alert("Este bar ya está registrado. Debes ingresar el código de 4 dígitos proporcionado por el administrador del bar.");
      return;
    }

    try {
      // 3. Llamada al servicio
      await this.rockolaService.registrarUsuarioConValidacion(this.datos, this.codigoRequerido);
      
      alert("¡Registro exitoso! Tu solicitud ha sido enviada. Por seguridad, un administrador de soporte debe activar tu cuenta.");
      this.router.navigate(['/']); 
      
    } catch (error: any) {
      alert(error.message);
    }
  }
}