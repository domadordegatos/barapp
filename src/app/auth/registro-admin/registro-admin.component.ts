import { Component, OnInit } from '@angular/core';
import { RockolaService } from '../../services/rockola.service';
import { Router } from '@angular/router';
import { NotificationService } from '../../services/notification.service';

@Component({
  selector: 'app-registro-admin',
  templateUrl: './registro-admin.component.html',
  styleUrls: ['./registro-admin.component.scss']
})
export class RegistroAdminComponent implements OnInit {
  datos = {
    nombreBar: '',
    correo: '',
    password: '',
    nitFactura: '',
    telefonoFactura: '',
    direccionFactura: ''
  };
  
  // Captcha
  num1 = Math.floor(Math.random() * 10);
  num2 = Math.floor(Math.random() * 10);
  captchaRespuesta: number | null = null;
  barExiste: boolean = false;
  codigoRequerido: string = '';

  constructor(
    private rockolaService: RockolaService,
    private router: Router,
    private notificationService: NotificationService
  ) {}

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
      this.notificationService.warning('Captcha incorrecto. Por favor resuelve la suma nuevamente.');
      this.num1 = Math.floor(Math.random() * 10);
      this.num2 = Math.floor(Math.random() * 10);
      this.captchaRespuesta = null;
      return;
    }

    // 2. Validación de seguridad para empleados
    if (this.barExiste && (!this.codigoRequerido || this.codigoRequerido.length !== 4)) {
      this.notificationService.warning('Este bar ya está registrado. Debes ingresar el código de 4 dígitos proporcionado por el administrador del bar.');
      return;
    }

    // 3. Si se registra un bar nuevo, solicitamos datos de factura obligatorios.
    if (!this.barExiste) {
      if (!this.datos.nitFactura.trim() || !this.datos.telefonoFactura.trim() || !this.datos.direccionFactura.trim()) {
        this.notificationService.warning('Para registrar un bar nuevo debes completar NIT, teléfono y dirección.');
        return;
      }
    }

    try {
      // 4. Llamada al servicio
      await this.rockolaService.registrarUsuarioConValidacion(this.datos, this.codigoRequerido);
      
      this.notificationService.success('Registro exitoso. Tu solicitud fue enviada y debe ser activada por soporte.');
      this.router.navigate(['/']); 
      
    } catch (error: any) {
      this.notificationService.error(error.message);
    }
  }
}