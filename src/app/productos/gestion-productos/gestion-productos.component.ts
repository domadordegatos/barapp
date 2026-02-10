import { Component, OnInit } from '@angular/core';
import { Observable } from 'rxjs';
import { VentasService } from 'src/app/services/ventas-service.service';
import { Producto } from 'src/app/interfaces/producto.interface';

@Component({
  selector: 'app-gestion-productos',
  templateUrl: './gestion-productos.component.html',
  styleUrls: ['./gestion-productos.component.scss']
})
export class GestionProductosComponent implements OnInit {
  nombreBarLimpio: string = '';
  productos$: Observable<any[]> | null = null;
  mostrandoForm = false;

  // Inicializamos el objeto según tu interfaz
  producto: Producto = {
    nombre: '',
    precio: 0,
    categoria: 'Bebidas',
    existencias: 0,
    controlInventario: false,
    disponible: true
  };

  categorias = ['Bebidas', 'Licores', 'Snacks', 'Comida', 'Otros'];

  constructor(private ventasService: VentasService) {}

  ngOnInit() {
    const sesion = sessionStorage.getItem('usuarioAdmin');
    if (sesion) {
      const datos = JSON.parse(sesion);
      this.nombreBarLimpio = datos.nombreBar.toLowerCase().replace(/\s+/g, '');
      
      // Cargamos la lista de productos del bar
      this.productos$ = this.ventasService.obtenerProductos(this.nombreBarLimpio);
    }
  }

  async guardarProducto() {
    if (!this.producto.nombre || this.producto.precio <= 0) {
      alert("Por favor completa el nombre y un precio válido.");
      return;
    }

    try {
      await this.ventasService.agregarProducto(this.nombreBarLimpio, this.producto);
      alert("Producto agregado exitosamente.");
      
      // Resetear formulario
      this.producto = {
        nombre: '', precio: 0, categoria: 'Bebidas',
        existencias: 0, controlInventario: false, disponible: true
      };
      this.mostrandoForm = false;
    } catch (error) {
      console.error("Error al guardar:", error);
    }
  }

  async eliminar(id: string) {
    if (confirm('¿Eliminar este producto?')) {
      await this.ventasService.eliminarProducto(id);
    }
  }
}