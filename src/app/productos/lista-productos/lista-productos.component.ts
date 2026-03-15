import { Component, Input, OnInit, OnChanges, SimpleChanges, Output, EventEmitter } from '@angular/core';
import { Observable, of } from 'rxjs';
import { Producto } from '../../interfaces/producto.interface';
import { Categoria } from '../../interfaces/categoria.interface';
import { ProductosService } from '../../services/productos.service';
import { animate, query, stagger, style, transition, trigger } from '@angular/animations';

type ProductoConIdYCantidad = Producto & { id: string; cantidad: number };

@Component({
  selector: 'app-lista-productos',
  templateUrl: './lista-productos.component.html',
  styleUrls: ['./lista-productos.component.scss'],
  animations: [
    trigger('accordionBody', [
      transition(':enter', [
        style({ opacity: 0, height: 0, transform: 'translateY(-10px)' }),
        animate('240ms ease-out', style({ opacity: 1, height: '*', transform: 'translateY(0)' }))
      ]),
      transition(':leave', [
        style({ opacity: 1, height: '*', transform: 'translateY(0)' }),
        animate('180ms ease-in', style({ opacity: 0, height: 0, transform: 'translateY(-8px)' }))
      ])
    ]),
    trigger('staggerProducts', [
      transition(':enter', [
        query('.card-producto', [
          style({ opacity: 0, transform: 'translateY(10px)' }),
          stagger(55, [
            animate('220ms ease-out', style({ opacity: 1, transform: 'translateY(0)' }))
          ])
        ], { optional: true })
      ])
    ])
  ]
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

  productoDisponible(producto: Producto): boolean {
    if (producto.visible === false) {
      return false;
    }

    if (!producto.disponible) {
      return false;
    }

    if (!producto.controlInventario) {
      return true;
    }

    return producto.existencias > 0;
  }

  cantidadCategoria(nombreCategoria: string): number {
    return Array.from(this.carrito.values())
      .filter(item => item.categoria === nombreCategoria)
      .reduce((total, item) => total + item.cantidad, 0);
  }

  productosComprables(productos: (Producto & { id: string })[]): (Producto & { id: string })[] {
    return productos.filter(producto => this.productoDisponible(producto));
  }

  sumarProducto(producto: Producto & { id: string }) {
    if (!this.productoDisponible(producto)) {
      return;
    }

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

  trackByCategoriaId(index: number, categoria: Categoria): string {
    return categoria.id;
  }

  trackByProductoId(index: number, producto: Producto & { id: string }): string {
    return producto.id;
  }

  private emitirCarrito() {
    this.carritoActualizado.emit(Array.from(this.carrito.values()));
  }
}
