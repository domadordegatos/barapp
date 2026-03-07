import { Component, Input, OnInit, OnChanges, SimpleChanges, Output, EventEmitter } from '@angular/core';
import { Observable, of } from 'rxjs';
import { Producto } from '../../interfaces/producto.interface';
import { Categoria } from '../../interfaces/categoria.interface';
import { ProductosService } from '../../services/productos.service';

type ProductoConIdYCantidad = Producto & { id: string; cantidad: number };

@Component({
  selector: 'app-lista-productos',
  templateUrl: './lista-productos.component.html',
  styleUrls: ['./lista-productos.component.scss']
})
export class ListaProductosComponent implements OnInit, OnChanges {

  @Input() nombreBarUrl: string = '';
  @Input() idMesaUrl: string = '';
  @Input() numeroMesaReal!: number;
  @Input() codigoAcceso: string = '';
  
  // NUEVO: Input para forzar el reinicio del carrito desde afuera
  @Input() resetCarrito: boolean = false;

  @Output() carritoActualizado = new EventEmitter<ProductoConIdYCantidad[]>();

  public categorias$: Observable<Categoria[]> = of([]);
  public productos$: Observable<(Producto & { id: string })[]> = of([]);
  public categoriaAbiertaId: string | null = null;

  private carrito = new Map<string, ProductoConIdYCantidad>();

  constructor(private productosService: ProductosService) { }

  ngOnInit(): void {
    if (this.nombreBarUrl) this.cargarCategorias();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['nombreBarUrl'] && !changes['nombreBarUrl'].firstChange) {
      this.cargarCategorias();
      this.limpiarCarritoLocal();
    }
    
    // Si el padre cambia 'resetCarrito' a true, limpiamos
    if (changes['resetCarrito'] && changes['resetCarrito'].currentValue === true) {
      this.limpiarCarritoLocal();
    }
  }

  limpiarCarritoLocal() {
    this.carrito.clear();
    this.emitirCarrito();
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
      if (item.cantidad <= 0) this.carrito.delete(producto.id);
    }
    this.emitirCarrito();
  }

  obtenerCantidad(idProducto: string): number {
    return this.carrito.get(idProducto)?.cantidad || 0;
  }

  private emitirCarrito() {
    this.carritoActualizado.emit(Array.from(this.carrito.values()));
  }
}
