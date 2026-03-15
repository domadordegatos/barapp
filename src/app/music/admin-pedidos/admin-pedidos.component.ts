import { Component, HostListener, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { RockolaService } from 'src/app/services/rockola.service';
import { Observable, Subscription } from 'rxjs';
import { NotificationService } from 'src/app/services/notification.service';

@Component({
  selector: 'app-admin-pedidos',
  templateUrl: './admin-pedidos.component.html',
  styleUrls: ['./admin-pedidos.component.scss']
})
export class AdminPedidosComponent implements OnInit, OnDestroy {
  seccionActiva: 'musica' | 'productos' | 'mesas' | 'datos-impresion' | 'historial-facturas' = 'musica';
  vistaMovilActiva: 'musica' | 'facturacion' = 'musica';
  nombreBarReal: string = 'Cargando...';
  nombreBarUrl: string = '';
  barValido: boolean = false;
  errorMensaje: string = '';
  esAdmin: boolean = false;
  userId: string = '';
  menuAbierto: boolean = false;
  esMobile: boolean = false;

  // --- Propiedades para la gestión de códigos ---
  codigoActual: string = '----';
  ultimaActualizacion: Date | null = null;
  codigoNuevo: string = '';
  codigoInvitacionNuevo: string = '';
  mostrandoModalLogout: boolean = false;

  // --- Observable para la lista de pedidos ---
  pedidos$!: Observable<any[]>;
  private barSubscription: Subscription | null = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    public rockolaService: RockolaService,
    private notificationService: NotificationService
  ) { }

  async ngOnInit() {
    this.actualizarVistaResponsive();

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
        this.nombreBarReal = datosUsuario.nombreBar;
        
        await this.sincronizarDatosBar();

        this.pedidos$ = this.rockolaService.obtenerPedidosPendientes(this.nombreBarUrl);

      } else {
        this.barValido = false;
        this.errorMensaje = `No tienes permisos para gestionar "${barUrl}".`;
      }
    } else {
      this.router.navigate(['/']);
    }
  }

  ngOnDestroy(): void {
    if (this.barSubscription) {
      this.barSubscription.unsubscribe();
    }
  }

  @HostListener('window:resize')
  actualizarVistaResponsive() {
    this.esMobile = window.innerWidth <= 980;
    if (!this.esMobile) {
      this.menuAbierto = false;
    }
  }

  alternarMenu() {
    this.menuAbierto = !this.menuAbierto;
  }

  cerrarMenu() {
    this.menuAbierto = false;
  }

  seleccionarSeccion(seccion: 'musica' | 'productos' | 'mesas' | 'datos-impresion' | 'historial-facturas') {
    const seccionRestringida = seccion === 'mesas' || seccion === 'datos-impresion' || seccion === 'historial-facturas';

    if (seccionRestringida && !this.esAdmin) {
      this.notificationService.warning('No tienes permisos para acceder a esta sección.');
      this.seccionActiva = 'musica';
      this.cerrarMenu();
      return;
    }

    this.seccionActiva = seccion;
    this.cerrarMenu();
  }

  private async sincronizarDatosBar() {
    const datosBar: any = await this.rockolaService.verificarExistenciaBar(this.nombreBarUrl);

    if (datosBar) {
      this.nombreBarReal = datosBar.nombreBarVisible || datosBar.nombreBar || this.nombreBarReal;
      this.codigoActual = datosBar.codigoSeguridad || '----';
      if (datosBar.ultimaActualizacion) {
        this.ultimaActualizacion = datosBar.ultimaActualizacion.toDate();
      }
    }

    if (this.barSubscription) {
      this.barSubscription.unsubscribe();
    }

    this.barSubscription = this.rockolaService.observarBar(this.nombreBarUrl).subscribe((bar: any) => {
      if (!bar) {
        return;
      }

      this.nombreBarReal = bar.nombreBarVisible || bar.nombreBar || this.nombreBarReal;
      this.codigoActual = bar.codigoSeguridad || this.codigoActual;

      if (bar.ultimaActualizacion?.toDate) {
        this.ultimaActualizacion = bar.ultimaActualizacion.toDate();
      }
    });
  }

  async guardarCodigo() {
    if (this.codigoNuevo.length !== 4 || !this.userId) {
      this.notificationService.warning('El código del día debe tener exactamente 4 dígitos.');
      return;
    }

    try {
      await this.rockolaService.actualizarCodigoDia(this.nombreBarUrl, this.codigoNuevo, this.userId, this.nombreBarReal);
      this.codigoActual = this.codigoNuevo;
      this.ultimaActualizacion = new Date();
      this.codigoNuevo = '';
      this.notificationService.success('Código del día actualizado con éxito.');
    } catch (error) {
      console.error('Error al actualizar el código:', error);
      this.notificationService.error('Hubo un error al actualizar el código.');
    }
  }

  async guardarCodigoInvitacion() {
    if (!this.esAdmin || !this.userId) {
      return;
    }

    if (this.codigoInvitacionNuevo.length !== 4) {
      this.notificationService.warning('El código de registro debe tener exactamente 4 dígitos.');
      return;
    }

    try {
      await this.rockolaService.actualizarCodigoInvitacion(this.userId, this.codigoInvitacionNuevo);
      this.codigoInvitacionNuevo = '';
      this.notificationService.success('Código de invitación actualizado.');
    } catch (error) {
      console.error('Error al actualizar código de invitación:', error);
      this.notificationService.error('Hubo un error al actualizar el código de invitación.');
    }
  }

  cambiarEstado(idPedido: string, nuevoEstado: 'aprobado' | 'rechazado' | 'reproduciendo') {
    this.rockolaService.actualizarEstadoPedido(idPedido, nuevoEstado)
      .catch(err => console.error('Error al cambiar estado del pedido', err));
  }

  solicitarLogout() {
    this.mostrandoModalLogout = true;
  }

  cerrarModalLogout() {
    this.mostrandoModalLogout = false;
  }

  confirmarLogout() {
    this.mostrandoModalLogout = false;
    sessionStorage.removeItem('usuarioAdmin');
    this.router.navigate(['/']);
  }

  volverInicio() {
    this.router.navigate(['/']);
  }
}
