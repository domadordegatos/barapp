import { Component, Input, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { Observable, of } from 'rxjs';
import { MesasService, Mesa } from '../../services/mesas.service';
import * as QRCode from 'qrcode';
import { environment } from '../../../environments/environment';
import { NotificationService } from '../../services/notification.service';

@Component({
  selector: 'app-gestion-mesas',
  templateUrl: './gestion-mesas.component.html',
  styleUrls: ['./gestion-mesas.component.scss']
})
export class GestionMesasComponent implements OnInit {
  @Input() esAdmin: boolean = false;

  nombreBarUrl: string = '';
  mesas$: Observable<Mesa[]> = of([]);
  
  formCrearMesa: FormGroup;
  errorCreacion: string | null = null;
  creandoMesa: boolean = false;

  constructor(
    private route: ActivatedRoute,
    private mesasService: MesasService,
    private fb: FormBuilder,
    private notificationService: NotificationService
  ) {
    this.formCrearMesa = this.fb.group({
      numero: [null, [Validators.required, Validators.min(1)]]
    });
  }

  ngOnInit(): void {
    this.nombreBarUrl = this.route.snapshot.paramMap.get('nombreBar') || '';
    if (this.nombreBarUrl) {
      this.cargarMesas();
    }
  }

  cargarMesas() {
    this.mesas$ = this.mesasService.getMesas(this.nombreBarUrl);
  }

  async crearMesa() {
    if (!this.esAdmin) {
      this.notificationService.warning('Solo un usuario admin puede crear mesas.');
      return;
    }

    if (this.formCrearMesa.invalid) return;

    this.creandoMesa = true;
    this.errorCreacion = null;
    const numero = this.formCrearMesa.value.numero;

    try {
      const yaExiste = await this.mesasService.numeroDeMesaExiste(this.nombreBarUrl, numero);
      if (yaExiste) {
        this.errorCreacion = `El número de mesa '${numero}' ya existe.`;
        this.creandoMesa = false;
        return;
      }

      await this.mesasService.crearMesa(this.nombreBarUrl, numero);
      this.formCrearMesa.reset();

    } catch (error) {
      console.error('Error al crear la mesa:', error);
      this.errorCreacion = 'Ocurrió un error inesperado al crear la mesa.';
    } finally {
      this.creandoMesa = false;
    }
  }

  toggleMesaEstado(mesa: Mesa) {
    if (!this.esAdmin) {
      this.notificationService.warning('Solo un usuario admin puede activar o inactivar mesas.');
      return;
    }

    if (!mesa.id) {
      console.error('La mesa no tiene un ID para poder actualizarla.');
      return;
    }

    const nuevoEstado = !mesa.activa;
    mesa.activa = nuevoEstado;

    this.mesasService.actualizarEstadoMesa(mesa.id, nuevoEstado).catch(error => {
      console.error('Error al actualizar el estado de la mesa:', error);
      mesa.activa = !nuevoEstado; 
    });
  }

  contarMesasActivas(mesas: Mesa[]): number {
    return (mesas || []).filter(mesa => mesa.activa).length;
  }

  // --- NUEVA FUNCIÓN PARA DESCARGAR EL CÓDIGO QR ---
  async descargarQR(mesa: Mesa, event: MouseEvent) {
    event.stopPropagation(); // Evita que el clic en el botón active el toggleMesaEstado de la tarjeta

    if (!mesa.id) {
      console.error('No se puede generar QR: La mesa no tiene ID.');
      return;
    }

    // 1. Construir la URL completa
    const url = `${environment.appBaseUrl}/${this.nombreBarUrl}/${mesa.id}`;

    try {
      // 2. Generar el código QR como un Data URL (base64)
      const qrDataUrl = await QRCode.toDataURL(url, {
        width: 512, // Mayor resolución para impresión
        margin: 2,
        errorCorrectionLevel: 'H' // Alta corrección de errores
      });

      // 3. Crear un enlace temporal para iniciar la descarga
      const link = document.createElement('a');
      link.href = qrDataUrl;
      link.download = `Mesa-${mesa.numero}_QR.png`; // Nombre del archivo
      
      // 4. Simular un clic en el enlace para descargar
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

    } catch (error) {
      console.error('Error al generar o descargar el código QR', error);
      // Aquí podrías notificar al usuario que hubo un problema
    }
  }
}
