import { Component, OnInit } from '@angular/core';
import { Observable } from 'rxjs';
import { RockolaService } from 'src/app/services/rockola.service';
import { NotificationService } from 'src/app/services/notification.service';

@Component({
  selector: 'app-gestion-musica',
  templateUrl: './gestion-music.component.html',
  styleUrls: ['./gestion-music.component.scss']
})
export class GestionMusicaComponent implements OnInit {
  pedidos$: Observable<any[]> | null = null;
  nombreBar: string = '';
  esAdmin: boolean = false;
  codigoNuevo: string = '';
  userId: string = '';
  codigoInvitacionNuevo: string = '';
  codigoActual: string = '----';
  ultimaActualizacion: any = null;

  constructor(
    private rockolaService: RockolaService,
    private notificationService: NotificationService
  ) {}

  async ngOnInit() {
    const sesion = sessionStorage.getItem('usuarioAdmin');
    if (sesion) {
      const datos = JSON.parse(sesion);
      // Guardamos los datos de sesión necesarios
      this.nombreBar = datos.nombreBar; 
      this.userId = datos.id;
      this.esAdmin = datos.tipo === 'admin';
      
      const barUrlNorm = this.nombreBar.toLowerCase().replace(/\s+/g, '');
      
      // 1. Cargamos los pedidos en tiempo real
      this.pedidos$ = this.rockolaService.obtenerPedidosPendientes(barUrlNorm);
      
      // 2. Cargamos la info del bar (Código y fecha)
      const datosBar: any = await this.rockolaService.verificarExistenciaBar(barUrlNorm);
      if (datosBar) {
        this.codigoActual = datosBar.codigoSeguridad;
        this.ultimaActualizacion = datosBar.ultimaActualizacion?.toDate();
      }
    }
  }

  // --- FUNCIONES RECUPERADAS ---

  guardarCodigo() {
    if (this.codigoNuevo.length !== 4) {
      this.notificationService.warning('El código debe ser de exactamente 4 dígitos.');
      return;
    }

    this.rockolaService.actualizarCodigoDia(this.nombreBar, this.codigoNuevo, this.userId)
      .then(() => {
        this.notificationService.success('Código del día actualizado correctamente.');
        this.codigoActual = this.codigoNuevo;
        this.ultimaActualizacion = new Date();
        this.codigoNuevo = '';
      })
      .catch(err => console.error("Error al actualizar código:", err));
  }

  cambiarEstado(id: string, estado: string) {
    this.rockolaService.actualizarEstadoPedido(id, estado)
      .then(() => console.log(`Pedido ${estado}`))
      .catch(err => console.error(err));
  }

  guardarCodigoInvitacion() {
    if (this.codigoInvitacionNuevo.length !== 4) {
      this.notificationService.warning('El código de invitación debe ser de 4 dígitos.');
      return;
    }

    this.rockolaService.actualizarCodigoInvitacion(this.userId, this.codigoInvitacionNuevo)
      .then(() => {
        this.notificationService.success('Código de registro para invitados actualizado.');
        this.codigoInvitacionNuevo = '';
      })
      .catch(err => console.error(err));
  }
}