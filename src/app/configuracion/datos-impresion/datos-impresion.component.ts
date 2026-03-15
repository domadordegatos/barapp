import { Component, Input, OnDestroy, OnInit } from '@angular/core';
import { Subscription } from 'rxjs';
import { NotificationService } from '../../services/notification.service';
import { RockolaService } from '../../services/rockola.service';

interface DatosImpresionForm {
  nombreBarVisible: string;
  nitFactura: string;
  telefonoFactura: string;
  direccionFactura: string;
  mensajeFactura: string;
  anchoFacturaCm: number;
  logoFactura: string;
}

@Component({
  selector: 'app-datos-impresion',
  templateUrl: './datos-impresion.component.html',
  styleUrls: ['./datos-impresion.component.scss']
})
export class DatosImpresionComponent implements OnInit, OnDestroy {
  @Input() nombreBar: string = '';
  @Input() nombreBarReal: string = '';

  cargando: boolean = true;
  guardando: boolean = false;
  logoError: string = '';
  datos: DatosImpresionForm = this.crearFormulario();

  private barSubscription: Subscription | null = null;

  constructor(
    private rockolaService: RockolaService,
    private notificationService: NotificationService
  ) {}

  ngOnInit(): void {
    if (!this.nombreBar) {
      this.cargando = false;
      return;
    }

    this.barSubscription = this.rockolaService.observarBar(this.nombreBar).subscribe({
      next: (bar: any) => {
        this.datos = {
          nombreBarVisible: bar?.nombreBarVisible || this.nombreBarReal || this.nombreBar,
          nitFactura: bar?.nitFactura || '',
          telefonoFactura: bar?.telefonoFactura || '',
          direccionFactura: bar?.direccionFactura || '',
          mensajeFactura: bar?.mensajeFactura || '',
          anchoFacturaCm: this.normalizarAncho(bar?.anchoFacturaCm),
          logoFactura: bar?.logoFactura || ''
        };
        this.logoError = '';
        this.cargando = false;
      },
      error: (error) => {
        console.error(error);
        this.cargando = false;
        this.notificationService.error('No se pudieron cargar los datos de impresión.');
      }
    });
  }

  ngOnDestroy(): void {
    if (this.barSubscription) {
      this.barSubscription.unsubscribe();
    }
  }

  async onLogoSeleccionado(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) {
      return;
    }

    if (file.type !== 'image/png') {
      this.logoError = 'La imagen debe estar en formato PNG.';
      input.value = '';
      return;
    }

    this.logoError = '';
    this.datos.logoFactura = await this.leerArchivoComoDataUrl(file);
    input.value = '';
  }

  quitarLogo() {
    this.datos.logoFactura = '';
    this.logoError = '';
  }

  async guardarDatos() {
    if (this.guardando) {
      return;
    }

    const nombreVisible = (this.datos.nombreBarVisible || '').trim();

    if (!nombreVisible) {
      this.notificationService.warning('El nombre visible del negocio es obligatorio.');
      return;
    }

    this.guardando = true;

    try {
      await this.rockolaService.actualizarDatosImpresion(this.nombreBar, {
        nombreBarVisible: nombreVisible,
        logoFactura: this.datos.logoFactura,
        nitFactura: this.datos.nitFactura,
        telefonoFactura: this.datos.telefonoFactura,
        direccionFactura: this.datos.direccionFactura,
        mensajeFactura: this.datos.mensajeFactura,
        anchoFacturaCm: this.normalizarAncho(this.datos.anchoFacturaCm)
      });

      this.notificationService.success('Datos de impresión actualizados.');
    } catch (error) {
      console.error(error);
      this.notificationService.error('No se pudieron guardar los datos de impresión.');
    } finally {
      this.guardando = false;
    }
  }

  private crearFormulario(): DatosImpresionForm {
    return {
      nombreBarVisible: this.nombreBarReal || this.nombreBar,
      nitFactura: '',
      telefonoFactura: '',
      direccionFactura: '',
      mensajeFactura: '',
      anchoFacturaCm: 8,
      logoFactura: ''
    };
  }

  private normalizarAncho(valor: any): number {
    const ancho = Number(valor);

    if (!Number.isFinite(ancho) || ancho <= 0) {
      return 8;
    }

    return Math.max(4, Math.min(12, Number(ancho.toFixed(2))));
  }

  private leerArchivoComoDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  }
}