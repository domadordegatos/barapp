import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { Observable, of } from 'rxjs';
import { MesasService, Mesa } from '../../services/mesas.service';
import { RockolaService } from '../../services/rockola.service';

@Component({
  selector: 'app-gestion-mesas',
  templateUrl: './gestion-mesas.component.html',
  styleUrls: ['./gestion-mesas.component.scss']
})
export class GestionMesasComponent implements OnInit {

  nombreBarUrl: string = '';
  mesas$: Observable<Mesa[]> = of([]);
  
  // Formulario para crear una nueva mesa
  formCrearMesa: FormGroup;
  errorCreacion: string | null = null;
  creandoMesa: boolean = false;

  constructor(
    private route: ActivatedRoute,
    private mesasService: MesasService,
    private rockolaService: RockolaService, // Lo usamos para obtener el nombre del bar
    private fb: FormBuilder
  ) {
    this.formCrearMesa = this.fb.group({
      numero: [null, [Validators.required, Validators.min(1)]]
    });
  }

  ngOnInit(): void {
    // Obtenemos el nombre del bar desde la URL, igual que en otros componentes de admin
    this.nombreBarUrl = this.route.snapshot.parent?.paramMap.get('nombreBar') || '';
    if (this.nombreBarUrl) {
      this.cargarMesas();
    }
  }

  cargarMesas() {
    this.mesas$ = this.mesasService.getMesas(this.nombreBarUrl);
  }

  async crearMesa() {
    if (this.formCrearMesa.invalid) {
      return;
    }

    this.creandoMesa = true;
    this.errorCreacion = null;
    const numero = this.formCrearMesa.value.numero;

    try {
      // 1. Validar si el número de mesa ya existe
      const yaExiste = await this.mesasService.numeroDeMesaExiste(this.nombreBarUrl, numero);
      if (yaExiste) {
        this.errorCreacion = `El número de mesa '${numero}' ya existe.`;
        this.creandoMesa = false;
        return;
      }

      // 2. Si no existe, crear la mesa
      await this.mesasService.crearMesa(this.nombreBarUrl, numero);
      this.formCrearMesa.reset(); // Limpiamos el formulario

    } catch (error) {
      console.error('Error al crear la mesa:', error);
      this.errorCreacion = 'Ocurrió un error inesperado al crear la mesa.';
    } finally {
      this.creandoMesa = false;
    }
  }

  cambiarEstadoMesa(mesa: Mesa, nuevoEstado: boolean) {
    if (mesa.id) {
        // El ID que usamos es el que nosotros generamos, no el de Firestore
      this.mesasService.actualizarEstadoMesa(mesa.id, nuevoEstado).catch(error => {
        console.error('Error al actualizar el estado:', error);
        // Aquí podrías añadir lógica para revertir el toggle visualmente si falla la actualización
      });
    }
  }
}
