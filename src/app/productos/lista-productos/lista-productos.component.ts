import { Component, Input, OnInit, OnChanges, SimpleChanges, Output, EventEmitter } from '@angular/core';
import { Observable, of } from 'rxjs';
import { Producto } from '../../interfaces/producto.interface';
import { Categoria } from '../../interfaces/categoria.interface';
import { ProductosService } from '../../services/productos.service';

// El producto que se maneja en el componente, con su ID y cantidad
type ProductoConIdYCantidad = Producto & { id: string; cantidad: number };

@Component({
  selector: 'app-lista-productos',
  templateUrl: './lista-productos.component.html',
  styleUrls: ['./lista-productos.component.scss']
})
export class ListaProductosComponent implements OnInit, OnChanges {

  // Inputs desde DashboardMesa
  @Input() nombreBarUrl: string = '';
  @Input() idMesaUrl: string = '';
  @Input() numeroMesaReal!: number;
  @Input() codigoAcceso: string = '';

  // Emite el carrito actualizado al componente padre
  @Output() carritoActualizado = new EventEmitter<ProductoConIdYCantidad[]>();

  public categorias$: Observable<Categoria[]> = of([]);
  public productos$: Observable<(Producto & { id: string })[]> = of([]);
  public categoriaAbiertaId: string | null = null;

  // Lógica del carrito, local en el componente
  private carrito = new Map<string, ProductoConIdYCantidad>();

  constructor(
    private productosService: ProductosService
  ) { }

  ngOnInit(): void {
    if (this.nombreBarUrl) {
      this.cargarCategorias();
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['nombreBarUrl'] && !changes['nombreBarUrl'].firstChange) {
      this.cargarCategorias();
      this.carrito.clear(); // Limpia el carrito si cambia el bar
      this.emitirCarrito();
    }
  }

  cargarCategorias() {
    this.categorias$ = this.productosService.obtenerCategorias(this.nombreBarUrl) as Observable<any[]>;
  }

  toggleCategoria(categoria: Categoria) {
    if (this.categoriaAbiertaId === categoria.id) {
      this.categoriaAbiertaId = null;
      this.productos$ = of([]);
    } else {
      this.categoriaAbiertaId = categoria.id;
      if (categoria.id && this.nombreBarUrl) {
        this.productos$ = this.productosService.obtenerProductosPorCategoria(this.nombreBarUrl, categoria.nombre) as Observable<(Producto & { id: string })[]>;
      }
    }
  }

  // --- LÓGICA DEL CARRITO ---

  sumarProducto(producto: Producto & { id: string }) {
    if (this.carrito.has(producto.id)) {
      this.carrito.get(producto.id)!.cantidad++;
    } else {
      this.carrito.set(producto.id, { ...producto, cantidad: 1 });
    }
    this.emitirCarrito();
  }

  restarProducto(producto: Producto & { id: string }) {
    if (this.carrito.has(producto.id)) {
      const item = this.carrito.get(producto.id)!;
      item.cantidad--;
      if (item.cantidad <= 0) {
        this.carrito.delete(producto.id);
      }
    }
    this.emitirCarrito();
  }

  obtenerCantidad(idProducto: string): number {
    return this.carrito.get(idProducto)?.cantidad || 0;
  }

  private emitirCarrito() {
    const carritoArray = Array.from(this.carrito.values());
    this.carritoActualizado.emit(carritoArray);
  }
}
