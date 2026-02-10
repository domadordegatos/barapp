import { Component, OnInit } from '@angular/core';
import { Observable } from 'rxjs';
import { ActivatedRoute, Router } from '@angular/router';
import { VentasService } from 'src/app/services/ventas-service.service';
import { RockolaService } from 'src/app/services/rockola.service';

@Component({
  selector: 'app-admin-pedidos',
  templateUrl: './admin-pedidos.component.html',
  styleUrls: ['./admin-pedidos.component.scss']
})
export class AdminPedidosComponent implements OnInit {
  pedidos$: Observable<any[]> | null = null;
  nombreBar: string = '';
  nombreBarReal: string = 'Cargando...';
  esAdmin: boolean = false;
  codigoNuevo: string = '';
  userId: string = '';
  barValido: boolean = false;
  errorMensaje: string = '';
  codigoInvitacionNuevo: string = '';
  codigoActual: string = '----';
  ultimaActualizacion: any = null;

// En admin-pedidos.component.ts
constructor(
  private route: ActivatedRoute,
  private router: Router,
  public rockolaService: RockolaService, // Para la música
  public ventasService: VentasService    // Para los productos
) { }

// admin-pedidos.component.ts
async ngOnInit() {
  const barUrl = this.route.snapshot.paramMap.get('nombreBar') || ''; // Recibe 'lachula'
  const sesion = sessionStorage.getItem('usuarioAdmin');

  if (sesion) {
    const datosUsuario = JSON.parse(sesion);
    const barSesionNorm = datosUsuario.nombreBar.toLowerCase().replace(/\s+/g, '');
    const barUrlNorm = barUrl.toLowerCase().replace(/\s+/g, '');

    if (barSesionNorm === barUrlNorm) {
      this.barValido = true;
      this.nombreBar = datosUsuario.nombreBar; // "La Chula" para etiquetas
      this.userId = datosUsuario.id;
      this.esAdmin = datosUsuario.tipo === 'admin';
      
      // IMPORTANTE: Usar barUrlNorm para las consultas a Firebase
      this.pedidos$ = this.rockolaService.obtenerPedidosPendientes(barUrlNorm);
      
      const datosBar: any = await this.rockolaService.verificarExistenciaBar(barUrlNorm);
      if (datosBar) {
        this.nombreBarReal = datosBar.nombreBar; 
        this.codigoActual = datosBar.codigoSeguridad;
        this.ultimaActualizacion = datosBar.ultimaActualizacion?.toDate();
      }
    } else {
      this.barValido = false;
      this.errorMensaje = `No tienes permisos para gestionar "${barUrl}".`;
    }
  } else {
    this.router.navigate(['/']);
  }
}

guardarCodigo() {
  if (this.codigoNuevo.length !== 4) {
    alert("El código debe ser de exactamente 4 dígitos.");
    return;
  }

  
  this.rockolaService.actualizarCodigoDia(this.nombreBar, this.codigoNuevo, this.userId)
    .then(() => {
      alert("Código del día actualizado correctamente.");
      // Actualizamos la vista local inmediatamente
      this.codigoActual = this.codigoNuevo;
      this.ultimaActualizacion = new Date();
      this.codigoNuevo = '';
    })
    .catch(err => console.error("Error al actualizar código:", err));
}

  logout() {
    if (confirm('¿Estás seguro de que deseas cerrar sesión?')) {
      sessionStorage.removeItem('usuarioAdmin');
      this.router.navigate(['/']);
    }
  }

  cambiarEstado(id: string, estado: string) {
    this.rockolaService.actualizarEstadoPedido(id, estado)
      .then(() => console.log(`Pedido ${estado}`))
      .catch(err => console.error(err));
  }

  guardarCodigoInvitacion() {
  if (this.codigoInvitacionNuevo.length !== 4) {
    alert("El código de invitación debe ser de 4 dígitos.");
    return;
  }

  this.rockolaService.actualizarCodigoInvitacion(this.userId, this.codigoInvitacionNuevo)
    .then(() => {
      alert("Código de registro para invitados actualizado.");
      this.codigoInvitacionNuevo = '';
    })
    .catch(err => console.error(err));
}
}