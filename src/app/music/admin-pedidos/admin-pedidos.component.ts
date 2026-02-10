import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { RockolaService } from 'src/app/services/rockola.service';

@Component({
  selector: 'app-admin-pedidos',
  templateUrl: './admin-pedidos.component.html',
  styleUrls: ['./admin-pedidos.component.scss']
})
export class AdminPedidosComponent implements OnInit {
  seccionActiva: string = 'musica'; // Controla la vista actual
  nombreBarReal: string = 'Cargando...';
  barValido: boolean = false;
  errorMensaje: string = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private rockolaService: RockolaService
  ) {}

  async ngOnInit() {
    const barUrl = this.route.snapshot.paramMap.get('nombreBar') || '';
    const sesion = sessionStorage.getItem('usuarioAdmin');

    if (sesion) {
      const datosUsuario = JSON.parse(sesion);
      const barSesionNorm = datosUsuario.nombreBar.toLowerCase().replace(/\s+/g, '');
      const barUrlNorm = barUrl.toLowerCase().replace(/\s+/g, '');

      if (barSesionNorm === barUrlNorm) {
        this.barValido = true;
        const datosBar: any = await this.rockolaService.verificarExistenciaBar(barUrlNorm);
        if (datosBar) {
          this.nombreBarReal = datosBar.nombreBar;
        }
      } else {
        this.barValido = false;
        this.errorMensaje = `No tienes permisos para gestionar "${barUrl}".`;
      }
    } else {
      this.router.navigate(['/']);
    }
  }

  logout() {
    if (confirm('¿Estás seguro de que deseas cerrar sesión?')) {
      sessionStorage.removeItem('usuarioAdmin');
      this.router.navigate(['/']);
    }
  }
}