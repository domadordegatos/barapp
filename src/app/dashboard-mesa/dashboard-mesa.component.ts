import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { RockolaService } from '../services/rockola.service';
import { trigger, transition, style, animate, group, query } from '@angular/animations';
import { Producto } from '../interfaces/producto.interface';
import { ProductosService } from '../services/productos.service';

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
  nombreBarUrl: string = '';
  idMesaUrl: string = '';
  numeroMesaReal: number | null = null;
  nombreBarReal: string = ''; 

  carrito: (Producto & { id: string, cantidad: number })[] = [];
  mostrandoResumenPedido: boolean = false;
  enviandoPedido: boolean = false;
  resetCarritoFlag: boolean = false;

  barValido: boolean = false;
  errorMensaje: string = '';
  cargandoValidacion: boolean = true;
  codigoIngresado: string = '';
  accesoAutorizado: boolean = false;
  vistaActual: 'songs' | 'products' = 'songs';

  constructor(
    private route: ActivatedRoute,
    private rockolaService: RockolaService,
    private productosService: ProductosService
  ) {}

  // Clave única: CODIGO_BAR_IDMESA
  get storageKey(): string {
    return `codigo_${this.nombreBarUrl.toLowerCase()}_${this.idMesaUrl}`;
  }

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
    return localStorage.getItem(this.storageKey) || '';
  }

  async verificarExistenciaDelBar() {
    try {
      const datosBar: any = await this.rockolaService.verificarExistenciaBar(this.nombreBarUrl);
      if (datosBar) {
        this.barValido = true;
        this.nombreBarReal = datosBar.nombreBar; 
      } else {
        this.barValido = false;
        this.errorMensaje = `El bar no existe.`;
      }
    } catch (error) {
      this.barValido = false;
      this.errorMensaje = "Error de conexión.";
    }
  }

  async obtenerDatosDeLaMesa() {
    const datosMesa = await this.rockolaService.obtenerDatosMesa(this.idMesaUrl);
    if (datosMesa) this.numeroMesaReal = datosMesa.numero;
  }

  async verificarSesionExistente() {
    const codigoGuardado = localStorage.getItem(this.storageKey);
    if (codigoGuardado) {
      const esValido = await this.rockolaService.validarCodigoBar(this.nombreBarUrl, codigoGuardado);
      if (esValido) {
        this.accesoAutorizado = true;
      } else {
        localStorage.removeItem(this.storageKey);
        this.accesoAutorizado = false;
      }
    }
  }

  async validarAcceso() {
    if (this.codigoIngresado.length !== 4) return;
    
    const esValido = await this.rockolaService.validarCodigoBar(this.nombreBarUrl, this.codigoIngresado);
    if (esValido) {
      localStorage.setItem(this.storageKey, this.codigoIngresado);
      this.accesoAutorizado = true;
    } else {
      alert("Código incorrecto.");
      this.codigoIngresado = '';
    }
  }

  onCarritoActualizado(carrito: any[]) {
    this.carrito = carrito;
  }

  async confirmarPedido() {
    if (this.enviandoPedido) return;
    this.enviandoPedido = true;
    try {
      await this.productosService.guardarPedidoEnCuenta(
        this.nombreBarUrl,
        this.idMesaUrl,
        this.numeroMesaReal,
        this.carrito,
        this.codigoAccesoVigente
      );
      alert('¡Pedido enviado!');
      this.resetCarritoFlag = true;
      setTimeout(() => this.resetCarritoFlag = false, 100);
      this.carrito = [];
      this.mostrandoResumenPedido = false;
    } catch (error) {
      console.error(error);
      alert('Error al enviar pedido.');
    } finally {
      this.enviandoPedido = false;
    }
  }
}
