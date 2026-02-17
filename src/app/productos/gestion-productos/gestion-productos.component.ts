import { Component, OnInit } from '@angular/core';
import { Observable } from 'rxjs';
import { AngularFirestore } from '@angular/fire/compat/firestore'; // Importación necesaria
import { VentasService } from 'src/app/services/ventas-service.service';
import { Producto } from 'src/app/interfaces/producto.interface';

@Component({
  selector: 'app-gestion-productos',
  templateUrl: './gestion-productos.component.html',
  styleUrls: ['./gestion-productos.component.scss']
})
export class GestionProductosComponent implements OnInit {
  nombreBarLimpio: string = '';
  nuevaCategoriaNombre: string = '';
  mostrandoForm = false;
  filtroBusqueda: string = '';
  editando: boolean = false;
  idProductoEdicion: string | null = null;

  // Observables para la suscripción automática en el HTML
  categorias$: Observable<any[]> | null = null;
  productos$: Observable<any[]> | null = null;

  // Objeto inicial para el formulario de productos
  producto: Producto = {
    nombre: '',
    precio: 0,
    categoria: '',
    existencias: 0,
    controlInventario: false,
    disponible: true,
    visible: true
  };

  constructor(
    private firestore: AngularFirestore, // <--- Firestore inyectado
    private ventasService: VentasService
  ) {}

  ngOnInit() {
    const sesion = sessionStorage.getItem('usuarioAdmin');
    if (sesion) {
      const datos = JSON.parse(sesion);
      this.nombreBarLimpio = datos.nombreBar.toLowerCase().replace(/\s+/g, '');
      
      // Cargamos los flujos de datos desde el servicio
      this.categorias$ = this.ventasService.obtenerCategorias(this.nombreBarLimpio);
      this.productos$ = this.ventasService.obtenerProductos(this.nombreBarLimpio);
    }
  }

  // 2. Función para cargar datos en el formulario (El botón del Lápiz)
prepararEdicion(p: any) {
  this.editando = true;
  this.mostrandoForm = true;
  this.idProductoEdicion = p.id;
  
  // Clonamos el objeto para no modificar la tabla mientras escribimos
  this.producto = { ...p };
  
  // Hacemos scroll suave hacia el formulario
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

  // --- LÓGICA DE CATEGORÍAS ---

  async crearCategoria() {
    if (!this.nuevaCategoriaNombre.trim()) return;
    
    try {
      const nuevaCat = {
        nombreBar: this.nombreBarLimpio,
        nombre: this.nuevaCategoriaNombre,
        activo: true, // Borrado lógico: por defecto visible
        fechaCreacion: new Date()
      };

      await this.firestore.collection('categorias_bares').add(nuevaCat);
      this.nuevaCategoriaNombre = ''; // Limpiar input
    } catch (error) {
      console.error("Error al crear categoría:", error);
      alert("No se pudo crear la categoría");
    }
  }

  async toggleCategoria(id: string, estadoActual: boolean) {
    try {
      await this.ventasService.cambiarEstadoCategoria(id, !estadoActual);
    } catch (error) {
      console.error("Error al cambiar estado:", error);
    }
  }

  // Función para cambiar disponibilidad (Cliente)
async toggleDisponibilidad(id: string, estadoActual: boolean) {
  await this.ventasService.actualizarProducto(id, { disponible: !estadoActual });
}

// Función para Archivar/Desarchivar (Vigencia)
// En gestion-productos.component.ts

async toggleVigencia(id: string, estadoActual: boolean) {
  const accion = estadoActual ? 'archivar' : 'reactivar';
  if (confirm(`¿Estás seguro de que deseas ${accion} este producto?`)) {
    try {
      await this.ventasService.actualizarProducto(id, { 
        visible: !estadoActual,
        disponible: !estadoActual ? false : true // Si se archiva, se oculta del cliente
      });
    } catch (error) {
      console.error("Error al cambiar vigencia:", error);
    }
  }
}
  async borrarCategoria(id: string) {
    if (confirm('¿Deseas eliminar definitivamente esta categoría?')) {
      await this.ventasService.eliminarCategoria(id);
    }
  }
  cancelarEdicion() {
  this.editando = false;
  this.idProductoEdicion = null;
  this.mostrandoForm = false;
  this.producto = { 
    nombre: '', precio: 0, categoria: '', existencias: 0, 
    controlInventario: false, disponible: true, visible: true 
  };
}

  // --- LÓGICA DE PRODUCTOS ---
// 3. Función unificada para Guardar o Actualizar
async guardarProducto() {
  if (!this.producto.nombre || !this.producto.precio || !this.producto.categoria) {
    alert("Faltan campos obligatorios");
    return;
  }

  try {
    if (this.editando && this.idProductoEdicion) {
      // MODO EDICIÓN
      await this.ventasService.actualizarProducto(this.idProductoEdicion, this.producto);
      alert("Producto actualizado con éxito");
    } else {
      // MODO CREACIÓN (Aseguramos estados iniciales)
      const nuevoProd = { ...this.producto, visible: true, disponible: true };
      await this.ventasService.agregarProducto(this.nombreBarLimpio, nuevoProd);
      alert("Producto creado con éxito");
    }
    this.cancelarEdicion();
  } catch (error) {
    console.error(error);
  }
}

  async toggleDisponibilidadProducto(p: any) {
    try {
      await this.ventasService.actualizarProducto(p.id, { disponible: !p.disponible });
    } catch (error) {
      console.error("Error al cambiar disponibilidad:", error);
    }
  }

  async eliminar(id: string) {
    if (confirm('¿Eliminar este producto permanentemente?')) {
      await this.ventasService.eliminarProducto(id);
    }
  }
}