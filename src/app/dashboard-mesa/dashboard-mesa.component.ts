import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { RockolaService } from '../services/rockola.service';
import { trigger, transition, style, animate, group, query } from '@angular/animations';
import { Producto } from '../interfaces/producto.interface';
import { ProductosService } from '../services/productos.service'; // <--- Importar ProductosService

@Component({
  selector: 'app-dashboard-mesa',
  templateUrl: './dashboard-mesa.component.html',
  styleUrls: ['./dashboard-mesa.component.scss'],
  animations: [
    trigger('slideContent', [
      transition('songs => products', [
        group([
          query(':enter', [
            style({ transform: 'translateX(100%)', opacity: 0 }),
            animate('400ms ease-out', style({ transform: 'translateX(0%)', opacity: 1 }))
          ], { optional: true }),
          query(':leave', [
            animate('400ms ease-out', style({ transform: 'translateX(-100%)', opacity: 0 }))
          ], { optional: true })
        ])
      ]),
      transition('products => songs', [
        group([
          query(':enter', [
            style({ transform: 'translateX(-100%)', opacity: 0 }),
            animate('400ms ease-out', style({ transform: 'translateX(0%)', opacity: 1 }))
          ], { optional: true }),
          query(':leave', [
            animate('400ms ease-out', style({ transform: 'translateX(100%)', opacity: 0 }))
          ], { optional: true })
        ])
      ])
    ])
  ]
})
export class DashboardMesaComponent implements OnInit {
  // Datos del Bar y Mesa
  nombreBarUrl: string = '';
  idMesaUrl: string = '';
  numeroMesaReal: number | null = null;
  nombreBarReal: string = ''; 

  // Carrito de compras y estado del pedido
  carrito: (Producto & { id: string, cantidad: number })[] = [];
  mostrandoResumenPedido: boolean = false;
  enviandoPedido: boolean = false;

  // Estados de carga y validación
  barValido: boolean = false;
  errorMensaje: string = '';
  cargandoValidacion: boolean = true;

  // Control de Acceso
  codigoIngresado: string = '';
  accesoAutorizado: boolean = false;
  
  // Navegación
  vistaActual: 'songs' | 'products' = 'songs';

  constructor(
    private route: ActivatedRoute,
    private rockolaService: RockolaService,
    private productosService: ProductosService // <--- Inyectar ProductosService
  ) {}

  async ngOnInit() {
    const parametroUrl = this.route.snapshot.paramMap.get('nombreBar') || '';
    this.nombreBarUrl = parametroUrl.toLowerCase().trim().replace(/\s+/g, ''); 
    this.idMesaUrl = this.route.snapshot.paramMap.get('idMesa') || '';

    await this.verificarExistenciaDelBar();

    if (this.barValido) {
      await this.obtenerDatosDeLaMesa();
      await this.verificarSesionExistente();
    }
    
    this.cargandoValidacion = false;
  }

  get codigoAccesoVigente(): string {
    return localStorage.getItem(`codigo_${this.nombreBarUrl.toLowerCase()}`) || '';
  }

  async verificarExistenciaDelBar() {
    try {
      const datosBar: any = await this.rockolaService.verificarExistenciaBar(this.nombreBarUrl);
      if (datosBar) {
        this.barValido = true;
        this.nombreBarReal = datosBar.nombreBar; 
      } else {
        this.barValido = false;
        this.errorMensaje = `El establecimiento "${this.nombreBarUrl}" no existe.`;
      }
    } catch (error) {
      this.barValido = false;
      this.errorMensaje = "Error de conexión con el servidor.";
    }
  }

  async obtenerDatosDeLaMesa() {
    const datosMesa = await this.rockolaService.obtenerDatosMesa(this.idMesaUrl);
    if (datosMesa) {
      this.numeroMesaReal = datosMesa.numero;
    }
  }

  async verificarSesionExistente() {
    const storageKey = `codigo_${this.nombreBarUrl.toLowerCase()}`;
    const codigoGuardado = localStorage.getItem(storageKey);
    
    if (codigoGuardado) {
      const esValido = await this.rockolaService.validarCodigoBar(this.nombreBarUrl, codigoGuardado);
      if (esValido) {
        this.accesoAutorizado = true;
      } else {
        localStorage.removeItem(storageKey);
      }
    }
  }

  async validarAcceso() {
    if (this.codigoIngresado.length !== 4) return;
    
    const esValido = await this.rockolaService.validarCodigoBar(this.nombreBarUrl, this.codigoIngresado);
    if (esValido) {
      localStorage.setItem(`codigo_${this.nombreBarUrl.toLowerCase()}`, this.codigoIngresado);
      this.accesoAutorizado = true;
    } else {
      alert("Código incorrecto. Pídelo a tu mesero.");
      this.codigoIngresado = '';
    }
  }

  cambiarVista(nuevaVista: 'songs' | 'products') {
    this.vistaActual = nuevaVista;
  }

  onCarritoActualizado(carrito: (Producto & { id: string, cantidad: number })[]) {
    this.carrito = carrito;
    // Si el carrito se vacía mientras vemos el resumen, lo cerramos.
    if (this.carrito.length === 0 && this.mostrandoResumenPedido) {
      this.mostrandoResumenPedido = false;
    }
  }

  // --- LÓGICA DEL RESUMEN DE PEDIDO ---

  mostrarResumen() {
    this.mostrandoResumenPedido = true;
  }

  ocultarResumen() {
    this.mostrandoResumenPedido = false;
  }

  calcularTotalPedido(): number {
    return this.carrito.reduce((total, item) => total + (item.precio * item.cantidad), 0);
  }

  async confirmarPedido() {
    this.enviandoPedido = true;
    try {
      await this.productosService.guardarPedidoEnCuenta(
        this.nombreBarUrl,
        this.idMesaUrl,
        this.numeroMesaReal,
        this.carrito,
        this.codigoAccesoVigente
      );
      alert('¡Pedido enviado con éxito! Tu mesero lo traerá pronto.');
      this.carrito = []; // Limpiamos el carrito
      this.ocultarResumen();
    } catch (error) {
      console.error('Error al enviar el pedido:', error);
      alert('Hubo un problema al enviar tu pedido. Por favor, inténtalo de nuevo.');
    } finally {
      this.enviandoPedido = false;
    }
  }
}
