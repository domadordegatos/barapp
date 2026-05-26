import { Component, Input, OnInit, OnChanges, SimpleChanges, Output, EventEmitter } from '@angular/core';
import { Observable, of } from 'rxjs';
import { Producto } from '../../interfaces/producto.interface';
import { Categoria } from '../../interfaces/categoria.interface';
import { ProductosService } from '../../services/productos.service';
import { animate, query, stagger, style, transition, trigger } from '@angular/animations';
import { catchError, shareReplay, take, tap } from 'rxjs/operators';

type ProductoConIdYCantidad = Producto & { id: string; cantidad: number };

@Component({
  selector: 'app-lista-productos',
  templateUrl: './lista-productos.component.html',
  styleUrls: ['./lista-productos.component.scss'],
  animations: [
    trigger('accordionBody', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(-6px)' }),
        animate('170ms cubic-bezier(0.2, 0, 0, 1)', style({ opacity: 1, transform: 'translateY(0)' }))
      ]),
      transition(':leave', [
        style({ opacity: 1, transform: 'translateY(0)' }),
        animate('120ms ease-in', style({ opacity: 0, transform: 'translateY(-4px)' }))
      ])
    ]),
    trigger('staggerProducts', [
      transition(':enter', [
        query('.card-producto', [
          style({ opacity: 0, transform: 'translateY(6px)' }),
          stagger(18, [
            animate('150ms cubic-bezier(0.2, 0, 0, 1)', style({ opacity: 1, transform: 'translateY(0)' }))
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
  public cargandoProductos: boolean = false;

  private carrito = new Map<string, ProductoConIdYCantidad>();
  private productosPorCategoria = new Map<string, Observable<(Producto & { id: string })[]>>();

  constructor(private productosService: ProductosService) { }

  ngOnInit(): void {
    if (this.nombreBarUrl) this.cargarCategorias();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['nombreBarUrl'] && !changes['nombreBarUrl'].firstChange) {
      this.cargarCategorias();
      this.limpiarCarritoLocal();
      this.categoriaAbiertaId = null;
      this.productos$ = of([]);
      this.productosPorCategoria.clear();
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
    this.categorias$ = (this.productosService.obtenerCategorias(this.nombreBarUrl) as Observable<Categoria[]>).pipe(
      tap((categorias: Categoria[]) => this.precargarCategorias(categorias))
    );
  }

  toggleCategoria(categoria: Categoria) {
    if (this.categoriaAbiertaId === categoria.id) {
      this.categoriaAbiertaId = null;
      this.cargandoProductos = false;
      this.productos$ = of([]);
    } else {
      this.categoriaAbiertaId = categoria.id;
      if (categoria.id && this.nombreBarUrl) {
        this.cargandoProductos = true;

        const productosCategoria$ = this.obtenerProductosCategoriaCached(categoria);
        this.productos$ = productosCategoria$.pipe(
          tap(() => {
            this.cargandoProductos = false;
          })
        );
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

  private obtenerProductosCategoriaCached(categoria: Categoria): Observable<(Producto & { id: string })[]> {
    const cacheKey = categoria.id;
    const cached = this.productosPorCategoria.get(cacheKey);
    if (cached) {
      return cached;
    }

    const stream$ = (this.productosService.obtenerProductosPorCategoria(this.nombreBarUrl, categoria.nombre) as Observable<(Producto & { id: string })[]>).pipe(
      catchError(() => of([])),
      shareReplay(1)
    );

    this.productosPorCategoria.set(cacheKey, stream$);
    return stream$;
  }

  private precargarCategorias(categorias: Categoria[]): void {
    categorias.forEach((categoria: Categoria) => {
      if (!categoria?.id || !categoria?.nombre) {
        return;
      }

      this.obtenerProductosCategoriaCached(categoria).pipe(take(1)).subscribe();
    });
  }

  private emitirCarrito() {
    this.carritoActualizado.emit(Array.from(this.carrito.values()));
  }
}
