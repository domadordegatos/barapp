import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { RockolaService } from '../services/rockola.service';
import { trigger, transition, style, animate, query, group } from '@angular/animations';

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
    private rockolaService: RockolaService
  ) {}

  async ngOnInit() {
    // 1. Obtener parámetros de la URL
    const parametroUrl = this.route.snapshot.paramMap.get('nombreBar') || '';
    this.nombreBarUrl = parametroUrl.toLowerCase().trim().replace(/\s+/g, ''); 
    this.idMesaUrl = this.route.snapshot.paramMap.get('idMesa') || '';

    // 2. Validar si el bar existe
    await this.verificarExistenciaDelBar();

    if (this.barValido) {
      await this.obtenerDatosDeLaMesa();
      await this.verificarSesionExistente();
    }
    
    this.cargandoValidacion = false;
  }

  // En dashboard-mesa.component.ts, añade este método o lógica
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
}