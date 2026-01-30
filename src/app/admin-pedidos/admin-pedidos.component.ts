import { Component, OnInit } from '@angular/core';
import { RockolaService } from '../services/rockola.service';
import { Observable } from 'rxjs';
import { Router } from '@angular/router';

@Component({
  selector: 'app-admin-pedidos',
  templateUrl: './admin-pedidos.component.html',
  styleUrls: ['./admin-pedidos.component.scss']
})
export class AdminPedidosComponent implements OnInit {
  pedidos$: Observable<any[]> | null = null;
  nombreBar: string = 'Administrador';
  esAdmin: boolean = false;
  codigoNuevo: string = '';
  userId: string = '';

  constructor(private router: Router, private rockolaService: RockolaService) {}

  ngOnInit(): void {
  const sesion = sessionStorage.getItem('usuarioAdmin');
    if (sesion) {
      const datos = JSON.parse(sesion);
      this.nombreBar = datos.nombreBar;
      this.userId = datos.id;
      // Verificamos si es el jefe
      this.esAdmin = datos.tipo === 'admin';
    }
    this.pedidos$ = this.rockolaService.obtenerPedidosPendientes();
  }

  guardarCodigo() {
  if (this.codigoNuevo.length !== 4) {
    alert("El código debe ser de exactamente 4 dígitos.");
    return;
  }

  this.rockolaService.actualizarCodigoDia(this.nombreBar, this.codigoNuevo, this.userId)
    .then(() => {
      alert("Código del día actualizado correctamente.");
      this.codigoNuevo = ''; // Limpiar input
    })
    .catch(err => console.error("Error al actualizar código:", err));
}

  logout() {
    if (confirm('¿Estás seguro de que deseas cerrar sesión?')) {
      sessionStorage.removeItem('usuarioAdmin'); // Borra la sesión
      this.router.navigate(['/']); // Redirige al login
    }
  }

  cambiarEstado(id: string, estado: string) {
    this.rockolaService.actualizarEstadoPedido(id, estado)
      .then(() => console.log(`Pedido ${estado}`))
      .catch(err => console.error(err));
  }
}