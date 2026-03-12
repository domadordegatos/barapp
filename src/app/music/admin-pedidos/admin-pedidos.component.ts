import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { RockolaService } from 'src/app/services/rockola.service';
import { Observable } from 'rxjs';

@Component({
  selector: 'app-admin-pedidos',
  templateUrl: './admin-pedidos.component.html',
  styleUrls: ['./admin-pedidos.component.scss']
})
export class AdminPedidosComponent implements OnInit {
  // --- Propiedades de estado y navegación ---
  seccionActiva: 'musica' | 'productos' | 'mesas' | 'facturacion' = 'musica';
  nombreBarReal: string = 'Cargando...';
  nombreBarUrl: string = '';
  barValido: boolean = false;
  errorMensaje: string = '';
  esAdmin: boolean = false;
  userId: string = '';

  // --- Propiedades para la gestión de códigos ---
  codigoActual: string = '----';
  ultimaActualizacion: Date | null = null;
  codigoNuevo: string = '';
  codigoInvitacionNuevo: string = '';

  // --- Observable para la lista de pedidos ---
  pedidos$: Observable<any[]>;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    public rockolaService: RockolaService
  ) { }

  async ngOnInit() {
    const barUrl = this.route.snapshot.paramMap.get('nombreBar') || '';
    this.nombreBarUrl = barUrl.toLowerCase().replace(/\s+/g, '');

    const sesion = sessionStorage.getItem('usuarioAdmin');

    if (sesion) {
      const datosUsuario = JSON.parse(sesion);
      const barSesionNorm = datosUsuario.nombreBar.toLowerCase().replace(/\s+/g, '');

      if (barSesionNorm === this.nombreBarUrl) {
        this.barValido = true;
        this.userId = datosUsuario.id;
        this.esAdmin = datosUsuario.tipo === 'admin';
        
        const datosBar: any = await this.rockolaService.verificarExistenciaBar(this.nombreBarUrl);
        if (datosBar) {
          this.nombreBarReal = datosBar.nombreBar;
          this.codigoActual = datosBar.codigoSeguridad || '----';
          if (datosBar.ultimaActualizacion) {
            this.ultimaActualizacion = datosBar.ultimaActualizacion.toDate();
          }
        }

        this.pedidos$ = this.rockolaService.obtenerPedidosPendientes(this.nombreBarUrl);

      } else {
        this.barValido = false;
        this.errorMensaje = `No tienes permisos para gestionar "${barUrl}".`;
      }
    } else {
      this.router.navigate(['/']);
    }
  }

  async guardarCodigo() {
    if (this.codigoNuevo.length !== 4 || !this.userId) return;
    try {
      await this.rockolaService.actualizarCodigoDia(this.nombreBarUrl, this.codigoNuevo, this.userId);
      this.codigoActual = this.codigoNuevo;
      this.ultimaActualizacion = new Date();
      this.codigoNuevo = '';
      alert('¡Código del día actualizado con éxito!');
    } catch (error) {
      console.error('Error al actualizar el código:', error);
      alert('Hubo un error al actualizar el código.');
    }
  }

  async guardarCodigoInvitacion() {
    if (!this.esAdmin || !this.userId) return;
    try {
      await this.rockolaService.actualizarCodigoInvitacion(this.userId, this.codigoInvitacionNuevo);
      this.codigoInvitacionNuevo = ''; // Limpiar campo
      alert('¡Código de invitación para empleados actualizado!');
    } catch (error) {
      console.error('Error al actualizar código de invitación:', error);
      alert('Hubo un error al actualizar el código de invitación.');
    }
  }

  cambiarEstado(idPedido: string, nuevoEstado: 'aprobado' | 'rechazado' | 'reproduciendo') {
    this.rockolaService.actualizarEstadoPedido(idPedido, nuevoEstado)
      .catch(err => console.error('Error al cambiar estado del pedido', err));
  }

  logout() {
    if (confirm('¿Estás seguro de que deseas cerrar sesión?')) {
      sessionStorage.removeItem('usuarioAdmin');
      this.router.navigate(['/']);
    }
  }
}
