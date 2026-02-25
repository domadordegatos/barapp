import { Component, Input, OnInit } from '@angular/core';
import { AdminService } from '../../services/admin.service'; 
import { ProductosService } from '../../services/productos.service';

@Component({
  selector: 'app-admin-facturacion',
  templateUrl: './admin-facturacion.component.html',
  styleUrls: ['./admin-facturacion.component.scss']
})
export class AdminFacturacionComponent implements OnInit {
  @Input() nombreBar: string = ''; 

  fechaInicio: string = '';
  fechaFin: string = '';
  tokensEncontrados: any[] = [];
  tokenSeleccionado: string = '';
  facturas: any[] = [];
  cargando: boolean = false;

  constructor(
    private adminService: AdminService,
    private productosService: ProductosService
  ) { 
    this.establecerFechaHoy();
  }

  ngOnInit(): void {
    console.log("DEBUG INICIAL: nombreBar recibido del padre:", this.nombreBar);
    if (this.nombreBar) {
      this.buscarSesiones();
    }
  }

  establecerFechaHoy() {
    const ahora = new Date();
    const anio = ahora.getFullYear();
    const mes = String(ahora.getMonth() + 1).padStart(2, '0');
    const dia = String(ahora.getDate()).padStart(2, '0');
    this.fechaInicio = `${anio}-${mes}-${dia}`;
    this.fechaFin = `${anio}-${mes}-${dia}`;
  }

  async buscarSesiones() {
    console.log("%c --- INICIANDO BÚSQUEDA ---", 'background: #222; color: #bada55');
    
    // Normalización para el log
    const barNormalizado = this.nombreBar.toLowerCase().replace(/\s+/g, '');
    console.log("1. Bar Original:", this.nombreBar);
    console.log("2. Bar Normalizado (lo que va a Firebase):", barNormalizado);

    if (!this.nombreBar) {
      console.error("ERROR: No hay nombreBar. El @Input no está llegando.");
      return;
    }

    this.cargando = true;
    this.tokensEncontrados = [];
    this.facturas = [];

    const inicio = new Date(this.fechaInicio + 'T00:00:00');
    const fin = new Date(this.fechaFin + 'T23:59:59');

    console.log("3. Rango de Fechas:", inicio.toLocaleString(), " HASTA ", fin.toLocaleString());

    // NOTA: Mantenemos el nombre obtenerTokensPorRango pero ahora apunta a la data real
    this.adminService.obtenerTokensPorRango(this.nombreBar, inicio, fin)
      .subscribe((data: any[]) => {
        console.log("%c 4. Respuesta de Firebase:", 'color: blue; font-weight: bold', data);
        
        // Asignamos la data directamente a facturas para mostrar la tabla de inmediato
        this.facturas = data;
        this.cargando = false;
        
        if (data && data.length > 0) {
          console.log(`ÉXITO: Se encontraron ${data.length} registros en cuentas_activas.`);
        } else {
          console.warn("AVISO: No se encontraron documentos.");
          console.log("Sugerencia: Revisa si en Firestore el campo 'nombreBar' tiene espacios o mayúsculas.");
        }
      }, error => {
        console.error("ERROR CRÍTICO:", error);
        this.cargando = false;
      });
  }

  // Mantenemos la función para no romper referencias, 
  // aunque buscarSesiones ahora trae la data directa
  cargarFacturasDelToken() {
    console.log("Ejecutando cargarFacturasDelToken para:", this.tokenSeleccionado);
    if (!this.tokenSeleccionado) return;

    this.adminService.obtenerCuentasPorToken(this.nombreBar, this.tokenSeleccionado)
      .subscribe(res => {
        this.facturas = res;
      });
  }

  verDetalle(f: any) {
    console.log("%c DETALLE DE FACTURA SELECCIONADA:", 'background: #444; color: #fff', f);
  }

  obtenerClaseEstado(estado: string): string {
    switch (estado) {
      case 'abierta': return 'badge-warning';
      case 'cerrada': return 'badge-success';
      default: return 'badge-secondary';
    }
  }
}