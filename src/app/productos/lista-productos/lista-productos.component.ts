import { Component, OnInit, Input } from '@angular/core';
import { ProductosService } from '../../services/productos.service'; // Asegura que la ruta sea correcta
import { Observable } from 'rxjs';

// Interfaces para mantener el código limpio y tipado
interface ItemCarrito {
  id: string;
  nombre: string;
  precio: number;
  cantidad: number;
}

@Component({
  selector: 'app-lista-productos',
  templateUrl: './lista-productos.component.html',
  styleUrls: ['./lista-productos.component.scss']
})
export class ListaProductosComponent implements OnInit {
  // Inputs recibidos desde el Dashboard para identificar el origen del pedido
  @Input() nombreBarUrl: string = '';
  @Input() idMesaUrl: string = '';
  @Input() numeroMesaReal: number | null = null;
  @Input() codigoAcceso: string = ''; // Recibido del dashboard

  // Observables para la carga reactiva de datos desde Firebase
  categorias$: Observable<any[]> | null = null;
  productos$: Observable<any[]> | null = null;
  
  // Estado de la vista y carrito
  categoriaSeleccionada: any | null = null;
  carrito: ItemCarrito[] = [];
  procesandoPedido: boolean = false;

  constructor(private productosService: ProductosService) { }

  ngOnInit(): void {
    // Carga inicial de categorías al entrar a la pestaña
    if (this.nombreBarUrl) {
      this.categorias$ = this.productosService.obtenerCategorias(this.nombreBarUrl);
    }
  }

  // --- NAVEGACIÓN ---

  seleccionarCategoria(cat: any) {
    this.categoriaSeleccionada = cat;
    // Solicitamos al servicio los productos que coincidan con el nombre de la categoría
    this.productos$ = this.productosService.obtenerProductosPorCategoria(
      this.nombreBarUrl, 
      cat.nombre
    );
  }

  regresar() {
    this.categoriaSeleccionada = null;
    this.productos$ = null;
  }

  // --- GESTIÓN DEL CARRITO (Lógica Virtual) ---

  sumarProducto(prod: any) {
    const item = this.carrito.find(p => p.id === prod.id);
    if (item) {
      item.cantidad++;
    } else {
      // Si el producto no está, lo agregamos con cantidad 1
      this.carrito.push({ 
        id: prod.id, 
        nombre: prod.nombre, 
        precio: prod.precio, 
        cantidad: 1 
      });
    }
  }

  restarProducto(prod: any) {
    const index = this.carrito.findIndex(p => p.id === prod.id);
    if (index !== -1) {
      this.carrito[index].cantidad--;
      // Si la cantidad llega a 0, lo eliminamos totalmente del carrito
      if (this.carrito[index].cantidad === 0) {
        this.carrito.splice(index, 1);
      }
    }
  }

  obtenerCantidad(id: string): number {
    const item = this.carrito.find(p => p.id === id);
    return item ? item.cantidad : 0;
  }

  // --- CÁLCULOS DINÁMICOS (Getters) ---

  get totalItems(): number {
    return this.carrito.reduce((acc, item) => acc + item.cantidad, 0);
  }

  get totalPrecio(): number {
    return this.carrito.reduce((acc, item) => acc + (item.precio * item.cantidad), 0);
  }

  // --- ACCIÓN FINAL: ENVÍO A FIREBASE ---

async enviarPedido() {
  if (this.carrito.length === 0 || this.procesandoPedido) return;
  this.procesandoPedido = true;

  try {
    // LLAMADA CORREGIDA (4 argumentos):
    await this.productosService.guardarPedidoEnCuenta(
      this.nombreBarUrl,
      this.idMesaUrl,
      this.numeroMesaReal,
      this.carrito,
      this.codigoAcceso
    );

    alert("¡Pedido enviado!");
    this.carrito = [];
    this.regresar();
  } catch (error) {
    console.error(error);
  } finally {
    this.procesandoPedido = false;
  }
}
}