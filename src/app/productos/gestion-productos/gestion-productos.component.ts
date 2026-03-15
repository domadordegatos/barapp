import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { firstValueFrom, Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { AngularFirestore } from '@angular/fire/compat/firestore'; // Importación necesaria
import { VentasService } from 'src/app/services/ventas-service.service';
import { Producto } from 'src/app/interfaces/producto.interface';
import { NotificationService } from 'src/app/services/notification.service';

@Component({
  selector: 'app-gestion-productos',
  templateUrl: './gestion-productos.component.html',
  styleUrls: ['./gestion-productos.component.scss']
})
export class GestionProductosComponent implements OnInit {
  @ViewChild('excelInput') excelInput?: ElementRef<HTMLInputElement>;
  private xlsxModulePromise: Promise<any> | null = null;
  private excelJsModulePromise: Promise<any> | null = null;

  esAdmin: boolean = false;
  nombreBarLimpio: string = '';
  nuevaCategoriaNombre: string = '';
  mostrandoForm = false;
  editando: boolean = false;
  idProductoEdicion: string | null = null;
  procesandoExcel: boolean = false;
  procesandoNormalizacion: boolean = false;
  procesandoBackfillValorCompra: boolean = false;
  procesandoEdicionCategoria: boolean = false;
  categoriaEditandoId: string | null = null;
  categoriaEditandoNombre: string = '';
  mostrandoModalVigencia: boolean = false;
  procesandoVigencia: boolean = false;
  vigenciaPendiente: { id: string; estadoActual: boolean; nombre: string } | null = null;

  // Observables para la suscripción automática en el HTML
  categorias$: Observable<any[]> | null = null;
  productos$: Observable<any[]> | null = null;
  productosOrdenados$: Observable<any[]> | null = null;

  // Objeto inicial para el formulario de productos
  producto: Producto = {
    nombre: '',
    precio: 0,
    valorCompra: 0,
    categoria: '',
    existencias: 0,
    controlInventario: false,
    disponible: true,
    visible: true
  };

  constructor(
    private firestore: AngularFirestore, // <--- Firestore inyectado
    private ventasService: VentasService,
    private notificationService: NotificationService
  ) {}

  ngOnInit() {
    const sesion = sessionStorage.getItem('usuarioAdmin');
    if (sesion) {
      const datos = JSON.parse(sesion);
      this.esAdmin = datos.tipo === 'admin';
      this.nombreBarLimpio = datos.nombreBar.toLowerCase().replace(/\s+/g, '');
      
      // Cargamos los flujos de datos desde el servicio
      this.categorias$ = this.ventasService.obtenerCategorias(this.nombreBarLimpio);
      this.productos$ = this.ventasService.obtenerProductos(this.nombreBarLimpio);
      this.productosOrdenados$ = this.productos$.pipe(
        map((productos: any[]) => {
          return [...productos].sort((a: any, b: any) => {
            const categoriaA = (a?.categoria || '').toString();
            const categoriaB = (b?.categoria || '').toString();
            const categoriaCmp = categoriaA.localeCompare(categoriaB, 'es', { sensitivity: 'base' });

            if (categoriaCmp !== 0) {
              return categoriaCmp;
            }

            const nombreA = (a?.nombre || '').toString();
            const nombreB = (b?.nombre || '').toString();
            return nombreA.localeCompare(nombreB, 'es', { sensitivity: 'base' });
          });
        })
      );
    }
  }

  // 2. Función para cargar datos en el formulario (El botón del Lápiz)
prepararEdicion(p: any) {
  if (!this.esAdmin) {
    this.notificationService.warning('No tienes permisos para editar productos.');
    return;
  }

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
      this.notificationService.error('No se pudo crear la categoría.');
    }
  }

  async toggleCategoria(id: string, estadoActual: boolean) {
    try {
      await this.ventasService.cambiarEstadoCategoria(id, !estadoActual);
    } catch (error) {
      console.error("Error al cambiar estado:", error);
    }
  }

  iniciarEdicionCategoria(categoria: any) {
    if (!this.esAdmin) {
      this.notificationService.warning('No tienes permisos para editar categorías.');
      return;
    }

    this.categoriaEditandoId = String(categoria?.id || '');
    this.categoriaEditandoNombre = String(categoria?.nombre || '').trim();
  }

  cancelarEdicionCategoria() {
    if (this.procesandoEdicionCategoria) {
      return;
    }

    this.categoriaEditandoId = null;
    this.categoriaEditandoNombre = '';
  }

  async guardarEdicionCategoria(categoria: any) {
    if (!this.esAdmin) {
      this.notificationService.warning('No tienes permisos para editar categorías.');
      return;
    }

    const idCategoria = String(categoria?.id || '').trim();
    const nombreActual = String(categoria?.nombre || '').trim();
    const nombreNuevo = this.categoriaEditandoNombre.trim();

    if (!idCategoria || !nombreNuevo) {
      this.notificationService.warning('Debes ingresar un nombre válido para la categoría.');
      return;
    }

    if (nombreNuevo === nombreActual) {
      this.cancelarEdicionCategoria();
      return;
    }

    this.procesandoEdicionCategoria = true;

    try {
      const categorias = await firstValueFrom(this.ventasService.obtenerCategorias(this.nombreBarLimpio));
      const nombreNuevoNormalizado = this.normalizarTexto(nombreNuevo);

      const existeDuplicada = (categorias || []).some((cat: any) => {
        const idCat = String(cat?.id || '').trim();
        if (idCat === idCategoria) {
          return false;
        }

        return this.normalizarTexto(cat?.nombre || '') === nombreNuevoNormalizado;
      });

      if (existeDuplicada) {
        this.notificationService.warning('Ya existe una categoría con ese nombre.');
        return;
      }

      await this.firestore.collection('categorias_bares').doc(idCategoria).update({
        nombre: nombreNuevo,
        ultimaActualizacion: new Date()
      });

      const productos = (await firstValueFrom(this.ventasService.obtenerProductos(this.nombreBarLimpio))) as any[];
      const nombreActualNormalizado = this.normalizarTexto(nombreActual);
      const productosCategoria = (productos || []).filter((producto: any) => {
        return this.normalizarTexto(producto?.categoria || '') === nombreActualNormalizado;
      });

      for (const producto of productosCategoria) {
        const idProducto = String(producto?.id || '').trim();
        if (!idProducto) {
          continue;
        }

        await this.ventasService.actualizarProducto(idProducto, { categoria: nombreNuevo });
      }

      if (this.editando && this.producto.categoria === nombreActual) {
        this.producto.categoria = nombreNuevo;
      }

      this.notificationService.success(`Categoría actualizada. Productos ajustados: ${productosCategoria.length}.`);
      this.cancelarEdicionCategoria();
    } catch (error) {
      console.error('Error al editar categoría:', error);
      this.notificationService.error('No se pudo actualizar la categoría.');
    } finally {
      this.procesandoEdicionCategoria = false;
    }
  }

  // Función para cambiar disponibilidad (Cliente)
async toggleDisponibilidad(id: string, estadoActual: boolean) {
  await this.ventasService.actualizarProducto(id, { disponible: !estadoActual });
}

// Función para Archivar/Desarchivar (Vigencia)
// En gestion-productos.component.ts

async toggleVigencia(id: string, estadoActual: boolean, nombre: string) {
  this.vigenciaPendiente = {
    id,
    estadoActual,
    nombre: nombre || 'este producto'
  };
  this.mostrandoModalVigencia = true;
}

cerrarModalVigencia() {
  if (this.procesandoVigencia) {
    return;
  }

  this.mostrandoModalVigencia = false;
  this.vigenciaPendiente = null;
}

async confirmarCambioVigencia() {
  if (!this.vigenciaPendiente || this.procesandoVigencia) {
    return;
  }

  this.procesandoVigencia = true;

  try {
    await this.ventasService.actualizarProducto(this.vigenciaPendiente.id, {
      visible: !this.vigenciaPendiente.estadoActual,
      disponible: !this.vigenciaPendiente.estadoActual ? false : true
    });

    this.notificationService.success(
      this.vigenciaPendiente.estadoActual
        ? 'Producto archivado correctamente.'
        : 'Producto reactivado correctamente.'
    );
    this.cerrarModalVigencia();
  } catch (error) {
    console.error('Error al cambiar vigencia:', error);
    this.notificationService.error('No se pudo actualizar la vigencia del producto.');
  } finally {
    this.procesandoVigencia = false;
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
    nombre: '', precio: 0, valorCompra: 0, categoria: '', existencias: 0, 
    controlInventario: false, disponible: true, visible: true 
  };
}

  // --- LÓGICA DE PRODUCTOS ---
// 3. Función unificada para Guardar o Actualizar
async guardarProducto() {
  if (!this.esAdmin) {
    this.notificationService.warning('No tienes permisos para crear o editar productos.');
    return;
  }

  if (!this.producto.nombre || !this.producto.precio || !this.producto.categoria) {
    this.notificationService.warning('Faltan campos obligatorios.');
    return;
  }

  try {
    if (this.editando && this.idProductoEdicion) {
      // MODO EDICIÓN
      await this.ventasService.actualizarProducto(this.idProductoEdicion, this.producto);
      this.notificationService.success('Producto actualizado con éxito.');
    } else {
      // MODO CREACIÓN (Aseguramos estados iniciales)
      const nuevoProd = { ...this.producto, visible: true, disponible: true };
      await this.ventasService.agregarProducto(this.nombreBarLimpio, nuevoProd);
      this.notificationService.success('Producto creado con éxito.');
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
    if (!this.esAdmin) {
      this.notificationService.warning('No tienes permisos para eliminar productos.');
      return;
    }

    if (confirm('¿Eliminar este producto permanentemente?')) {
      await this.ventasService.eliminarProducto(id);
    }
  }

  async descargarInventarioExcel() {
    if (!this.esAdmin) {
      this.notificationService.warning('Solo un admin puede descargar inventario por Excel.');
      return;
    }

    if (!this.nombreBarLimpio) {
      this.notificationService.warning('No se pudo identificar el bar para exportar.');
      return;
    }

    this.procesandoExcel = true;

    try {
      const productos = await firstValueFrom(this.ventasService.obtenerProductos(this.nombreBarLimpio));
      const categorias = await firstValueFrom(this.ventasService.obtenerCategorias(this.nombreBarLimpio));
      const categoriasValidas = (categorias || []).map((cat: any) => String(cat?.nombre || '').trim()).filter(Boolean);

      const ExcelJS = await this.obtenerModuloExcelJs();
      const libro = new ExcelJS.Workbook();

      const hojaInventario = libro.addWorksheet('Inventario');
      const hojaCatalogos = libro.addWorksheet('Catalogos');
      const hojaGuia = libro.addWorksheet('Guia');

      hojaInventario.columns = [
        { header: 'ID_PRODUCTO', key: 'id', width: 30 },
        { header: 'NOMBRE', key: 'nombre', width: 35 },
        { header: 'CATEGORIA', key: 'categoria', width: 25 },
        { header: 'PRECIO', key: 'precio', width: 14 },
        { header: 'VALOR_COMPRA', key: 'valorCompra', width: 16 },
        { header: 'STOCK', key: 'stock', width: 12 },
        { header: 'VIGENTE', key: 'vigente', width: 12 }
      ];

      (productos || []).forEach((p: any) => {
        hojaInventario.addRow({
          id: p?.id || '',
          nombre: p?.nombre || '',
          categoria: p?.categoria || '',
          precio: Number(p?.precio || 0),
          valorCompra: Number(p?.valorCompra || 0),
          stock: Number(p?.existencias || 0),
          vigente: p?.visible === false ? 'NO' : 'SI'
        });
      });

      hojaCatalogos.columns = [
        { header: 'CATEGORIAS_VALIDAS', key: 'categoria', width: 28 },
        { header: 'VIGENTE_VALIDO', key: 'vigente', width: 18 }
      ];

      const totalCatalogo = Math.max(categoriasValidas.length, 2);
      for (let i = 0; i < totalCatalogo; i++) {
        hojaCatalogos.addRow({
          categoria: categoriasValidas[i] || '',
          vigente: i === 0 ? 'SI' : i === 1 ? 'NO' : ''
        });
      }

      hojaCatalogos.state = 'veryHidden';

      const inicioDatos = 2;
      const finDatos = Math.max(hojaInventario.rowCount, inicioDatos);
      const finCategorias = Math.max(categoriasValidas.length + 1, 2);

      // Encabezados bloqueados
      ['A1', 'B1', 'C1', 'D1', 'E1', 'F1', 'G1'].forEach((celda) => {
        hojaInventario.getCell(celda).protection = { locked: true };
      });

      for (let fila = inicioDatos; fila <= finDatos; fila++) {
        // Columna ID bloqueada para evitar modificaciones accidentales.
        hojaInventario.getCell(`A${fila}`).protection = { locked: true };

        // Columnas editables del inventario.
        hojaInventario.getCell(`B${fila}`).protection = { locked: false };
        hojaInventario.getCell(`C${fila}`).protection = { locked: false };
        hojaInventario.getCell(`D${fila}`).protection = { locked: false };
        hojaInventario.getCell(`E${fila}`).protection = { locked: false };
        hojaInventario.getCell(`F${fila}`).protection = { locked: false };
        hojaInventario.getCell(`G${fila}`).protection = { locked: false };

        hojaInventario.getCell(`C${fila}`).dataValidation = {
          type: 'list',
          allowBlank: false,
          formulae: [`Catalogos!$A$2:$A$${finCategorias}`],
          errorStyle: 'stop',
          showErrorMessage: true,
          errorTitle: 'Categoria invalida',
          error: 'Selecciona una categoria existente del listado.'
        };

        hojaInventario.getCell(`G${fila}`).dataValidation = {
          type: 'list',
          allowBlank: false,
          formulae: ['"SI,NO"'],
          errorStyle: 'stop',
          showErrorMessage: true,
          errorTitle: 'Valor invalido',
          error: 'Solo puedes seleccionar SI o NO.'
        };
      }

      await hojaInventario.protect('inventario-seguro', {
        selectLockedCells: true,
        selectUnlockedCells: true,
        formatCells: false,
        formatColumns: false,
        formatRows: false,
        insertColumns: false,
        insertRows: false,
        deleteColumns: false,
        deleteRows: false,
        sort: false,
        autoFilter: false,
        pivotTables: false
      });

      hojaGuia.columns = [
        { header: 'CAMPO', key: 'campo', width: 24 },
        { header: 'USO', key: 'uso', width: 95 }
      ];

      [
        { campo: 'ID_PRODUCTO', uso: 'No modificar. Se usa para actualizar el producto correcto en la base de datos.' },
        { campo: 'NOMBRE', uso: 'Nombre del producto.' },
        { campo: 'CATEGORIA', uso: 'Solo permite seleccionar categorias existentes desde lista desplegable.' },
        { campo: 'PRECIO', uso: 'Precio de venta al cliente.' },
        { campo: 'VALOR_COMPRA', uso: 'Costo unitario de compra para el bar. Se usa en calculos de ganancia y arqueo.' },
        { campo: 'STOCK', uso: 'Cantidad disponible. Si escribes stock se activara control de inventario.' },
        { campo: 'VIGENTE', uso: 'Solo permite SI o NO desde lista desplegable.' }
      ].forEach((item) => hojaGuia.addRow(item));

      const buffer = await libro.xlsx.writeBuffer();

      const fecha = new Date().toISOString().slice(0, 10);
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });
      const url = URL.createObjectURL(blob);
      const enlace = document.createElement('a');
      enlace.href = url;
      enlace.download = `inventario_${this.nombreBarLimpio}_${fecha}.xlsx`;
      document.body.appendChild(enlace);
      enlace.click();
      document.body.removeChild(enlace);
      URL.revokeObjectURL(url);

      this.notificationService.success('Archivo Excel generado correctamente.');
    } catch (error) {
      console.error('Error al descargar inventario en Excel:', error);
      this.notificationService.error('No se pudo generar el archivo de inventario.');
    } finally {
      this.procesandoExcel = false;
    }
  }

  async normalizarProductosAntiguos() {
    if (!this.esAdmin) {
      this.notificationService.warning('Solo un admin puede normalizar productos.');
      return;
    }

    if (!this.nombreBarLimpio) {
      this.notificationService.warning('No se pudo identificar el bar para normalizar productos.');
      return;
    }

    const confirmar = confirm('Se completaran campos faltantes (controlInventario, visible, disponible y valorCompra) y se desactivara controlInventario cuando el producto tenga stock 0. ¿Deseas continuar?');
    if (!confirmar) {
      return;
    }

    this.procesandoNormalizacion = true;

    try {
      const productos = (await firstValueFrom(this.ventasService.obtenerProductos(this.nombreBarLimpio))) as any[];
      let actualizados = 0;

      for (const producto of productos || []) {
        const idProducto = String(producto?.id || '').trim();
        if (!idProducto) {
          continue;
        }

        const cambios: any = {};

        if (typeof producto?.controlInventario !== 'boolean') {
          cambios.controlInventario = false;
        }

        const controlInventarioActual = (cambios.controlInventario ?? producto?.controlInventario) === true;
        const existenciasActuales = Number(producto?.existencias || 0);
        if (controlInventarioActual && existenciasActuales <= 0) {
          cambios.controlInventario = false;
        }

        if (typeof producto?.visible !== 'boolean') {
          cambios.visible = true;
        }

        if (typeof producto?.disponible !== 'boolean') {
          cambios.disponible = true;
        }

        if (producto?.valorCompra === undefined || producto?.valorCompra === null) {
          cambios.valorCompra = 0;
        }

        if (Object.keys(cambios).length === 0) {
          continue;
        }

        await this.ventasService.actualizarProducto(idProducto, cambios);
        actualizados++;
      }

      if (actualizados > 0) {
        this.notificationService.success(`Normalizacion completada: ${actualizados} productos actualizados.`);
      } else {
        this.notificationService.success('No se encontraron productos para normalizar.');
      }
    } catch (error) {
      console.error('Error normalizando productos antiguos:', error);
      this.notificationService.error('No se pudo completar la normalizacion de productos.');
    } finally {
      this.procesandoNormalizacion = false;
    }
  }

  async actualizarValorCompraEnFacturasExistentes() {
    if (!this.esAdmin) {
      this.notificationService.warning('Solo un admin puede ejecutar esta actualización.');
      return;
    }

    if (!this.nombreBarLimpio) {
      this.notificationService.warning('No se pudo identificar el bar para actualizar facturas.');
      return;
    }

    const confirmar = confirm('Este proceso temporal completara valorCompra en items de cuentas_activas y facturas_finalizadas para este bar usando el catalogo actual. ¿Deseas continuar?');
    if (!confirmar) {
      return;
    }

    this.procesandoBackfillValorCompra = true;

    try {
      const productos = (await firstValueFrom(this.ventasService.obtenerProductos(this.nombreBarLimpio))) as any[];
      const mapaValorCompraPorId = new Map<string, number>();
      const mapaValorCompraPorNombre = new Map<string, number>();

      for (const producto of productos || []) {
        const id = String(producto?.id || '').trim();
        const nombre = this.normalizarTexto(producto?.nombre || '');
        const valorCompra = Number(producto?.valorCompra || 0);

        if (id) {
          mapaValorCompraPorId.set(id, valorCompra);
        }

        if (nombre) {
          mapaValorCompraPorNombre.set(nombre, valorCompra);
        }
      }

      const resultadoCuentas = await this.backfillValorCompraEnColeccion(
        'cuentas_activas',
        mapaValorCompraPorId,
        mapaValorCompraPorNombre
      );

      const resultadoFacturas = await this.backfillValorCompraEnColeccion(
        'facturas_finalizadas',
        mapaValorCompraPorId,
        mapaValorCompraPorNombre
      );

      const documentosActualizados = resultadoCuentas.documentosActualizados + resultadoFacturas.documentosActualizados;
      const itemsActualizados = resultadoCuentas.itemsActualizados + resultadoFacturas.itemsActualizados;

      if (documentosActualizados > 0) {
        this.notificationService.success(
          `Actualizacion completada. Documentos: ${documentosActualizados}, items con valorCompra cargado: ${itemsActualizados}.`
        );
      } else {
        this.notificationService.success('No se encontraron items pendientes de valorCompra en cuentas o facturas.');
      }
    } catch (error) {
      console.error('Error actualizando valorCompra en facturas existentes:', error);
      this.notificationService.error('No se pudo completar la actualización temporal de valorCompra.');
    } finally {
      this.procesandoBackfillValorCompra = false;
    }
  }

  private async backfillValorCompraEnColeccion(
    nombreColeccion: 'cuentas_activas' | 'facturas_finalizadas',
    mapaValorCompraPorId: Map<string, number>,
    mapaValorCompraPorNombre: Map<string, number>
  ): Promise<{ documentosActualizados: number; itemsActualizados: number }> {
    const snapshot = await this.firestore.collection(nombreColeccion, ref =>
      ref.where('nombreBar', '==', this.nombreBarLimpio)
    ).get().toPromise();

    if (!snapshot || snapshot.empty) {
      return { documentosActualizados: 0, itemsActualizados: 0 };
    }

    let documentosActualizados = 0;
    let itemsActualizados = 0;

    for (const doc of snapshot.docs) {
      const data = doc.data() as any;
      const pedidosOriginales = Array.isArray(data?.pedidos) ? data.pedidos : [];
      if (!pedidosOriginales.length) {
        continue;
      }

      const { pedidosActualizados, cambios } = this.completarValorCompraEnPedidos(
        pedidosOriginales,
        mapaValorCompraPorId,
        mapaValorCompraPorNombre
      );

      if (cambios === 0) {
        continue;
      }

      await this.firestore.collection(nombreColeccion).doc(doc.id).update({ pedidos: pedidosActualizados });
      documentosActualizados++;
      itemsActualizados += cambios;
    }

    return { documentosActualizados, itemsActualizados };
  }

  private completarValorCompraEnPedidos(
    pedidos: any[],
    mapaValorCompraPorId: Map<string, number>,
    mapaValorCompraPorNombre: Map<string, number>
  ): { pedidosActualizados: any[]; cambios: number } {
    let cambios = 0;

    const pedidosActualizados = pedidos.map((pedido: any) => {
      const items = Array.isArray(pedido?.items) ? pedido.items : [];

      const itemsActualizados = items.map((item: any) => {
        const yaTieneValorCompra = item?.valorCompra !== undefined && item?.valorCompra !== null;
        if (yaTieneValorCompra) {
          return item;
        }

        const idProd = String(item?.idProd || '').trim();
        const nombreProd = this.normalizarTexto(item?.nombre || '');

        let valorCompra = 0;
        if (idProd && mapaValorCompraPorId.has(idProd)) {
          valorCompra = Number(mapaValorCompraPorId.get(idProd) || 0);
        } else if (nombreProd && mapaValorCompraPorNombre.has(nombreProd)) {
          valorCompra = Number(mapaValorCompraPorNombre.get(nombreProd) || 0);
        }

        cambios++;
        return {
          ...item,
          valorCompra
        };
      });

      return {
        ...pedido,
        items: itemsActualizados
      };
    });

    return { pedidosActualizados, cambios };
  }

  abrirSelectorExcel() {
    if (!this.esAdmin) {
      this.notificationService.warning('Solo un admin puede cargar inventario desde Excel.');
      return;
    }

    this.excelInput?.nativeElement.click();
  }

  async cargarInventarioDesdeExcel(event: Event) {
    if (!this.esAdmin) {
      this.notificationService.warning('Solo un admin puede cargar inventario desde Excel.');
      return;
    }

    const input = event.target as HTMLInputElement;
    const archivo = input?.files?.[0];

    if (!archivo || !this.nombreBarLimpio) {
      return;
    }

    this.procesandoExcel = true;

    try {
      const XLSX = await this.obtenerModuloExcel();
      const buffer = await archivo.arrayBuffer();
      const libro = XLSX.read(buffer, { type: 'array' });
      const nombreHoja = libro.SheetNames[0];

      if (!nombreHoja) {
        this.notificationService.warning('El archivo Excel no contiene hojas.');
        return;
      }

      const hoja = libro.Sheets[nombreHoja];
      const filas: any[] = XLSX.utils.sheet_to_json(hoja, { defval: '' });

      if (!filas.length) {
        this.notificationService.warning('El archivo no tiene filas para procesar.');
        return;
      }

      const productosActuales = await firstValueFrom(this.ventasService.obtenerProductos(this.nombreBarLimpio));
      const categoriasActuales = await firstValueFrom(this.ventasService.obtenerCategorias(this.nombreBarLimpio));
      const categoriasValidas = new Set(
        (categoriasActuales || [])
          .map((cat: any) => this.normalizarTexto(cat?.nombre || ''))
          .filter(Boolean)
      );
      const mapaProductos = new Map<string, any>((productosActuales || []).map((p: any) => [String(p?.id || ''), p]));

      let actualizados = 0;
      let omitidos = 0;
      let noEncontrados = 0;
      let errores = 0;
      let categoriasInvalidas = 0;

      for (const fila of filas) {
        const idProducto = String(this.obtenerValorColumna(fila, ['ID_PRODUCTO', 'ID', 'ID_UNICO', 'CODIGO', 'CODIGO_PRODUCTO'])).trim();

        if (!idProducto) {
          omitidos++;
          continue;
        }

        const productoActual = mapaProductos.get(idProducto);

        if (!productoActual) {
          noEncontrados++;
          continue;
        }

        const nombre = String(this.obtenerValorColumna(fila, ['NOMBRE', 'PRODUCTO', 'NOMBRE_PRODUCTO'])).trim();
        const categoria = String(this.obtenerValorColumna(fila, ['CATEGORIA', 'CATEGORIA_PRODUCTO'])).trim();
        const precioRaw = this.obtenerValorColumna(fila, ['PRECIO', 'VALOR', 'PRECIO_PRODUCTO']);
        const valorCompraRaw = this.obtenerValorColumna(fila, ['VALOR_COMPRA', 'COSTO', 'PRECIO_COMPRA', 'COSTO_UNITARIO']);
        const stockRaw = this.obtenerValorColumna(fila, ['STOCK', 'EXISTENCIAS', 'CANTIDAD']);
        const vigenciaRaw = this.obtenerValorColumna(fila, ['VIGENTE', 'VIGENCIA', 'VISIBLE', 'ACTIVO']);

        const stockEnviado = this.tieneDato(stockRaw);
        const visible = this.parsearBooleanoVigencia(vigenciaRaw, productoActual?.visible !== false);
        const disponibleActual = productoActual?.disponible !== false;

        let categoriaFinal = productoActual?.categoria || '';
        if (categoria) {
          const categoriaNormalizada = this.normalizarTexto(categoria);
          if (categoriasValidas.has(categoriaNormalizada)) {
            categoriaFinal = categoria;
          } else {
            categoriasInvalidas++;
          }
        }

        const datosActualizados: any = {
          nombre: nombre || productoActual?.nombre || '',
          categoria: categoriaFinal,
          precio: Math.max(0, this.parsearNumero(precioRaw, Number(productoActual?.precio || 0))),
          valorCompra: Math.max(0, this.parsearNumero(valorCompraRaw, Number(productoActual?.valorCompra || 0))),
          visible,
          disponible: visible ? disponibleActual : false
        };

        if (stockEnviado) {
          const stock = Math.max(0, Math.trunc(this.parsearNumero(stockRaw, Number(productoActual?.existencias || 0))));
          datosActualizados.existencias = stock;
          datosActualizados.controlInventario = true;
        }

        try {
          await this.ventasService.actualizarProducto(idProducto, datosActualizados);
          actualizados++;
        } catch (error) {
          errores++;
          console.error(`Error actualizando producto ${idProducto}:`, error);
        }
      }

      if (actualizados > 0) {
        this.notificationService.success(`Excel procesado: ${actualizados} productos actualizados.`);
      }

      if (omitidos > 0 || noEncontrados > 0 || errores > 0) {
        this.notificationService.warning(
          `Resumen: omitidos sin ID ${omitidos}, no encontrados ${noEncontrados}, errores ${errores}.`
        );
      }

      if (categoriasInvalidas > 0) {
        this.notificationService.warning(
          `Se ignoraron ${categoriasInvalidas} filas con categorias no validas.`
        );
      }

      if (actualizados === 0 && omitidos === 0 && noEncontrados === 0 && errores === 0) {
        this.notificationService.warning('No se detectaron cambios en el archivo Excel.');
      }
    } catch (error) {
      console.error('Error al cargar inventario desde Excel:', error);
      this.notificationService.error('No se pudo procesar el archivo Excel.');
    } finally {
      this.procesandoExcel = false;
      if (input) {
        input.value = '';
      }
    }
  }

  private obtenerValorColumna(fila: any, alias: string[]): any {
    const claves = Object.keys(fila || {});

    for (const nombreAlias of alias) {
      const aliasNormalizado = this.normalizarTexto(nombreAlias);
      const claveEncontrada = claves.find(clave => this.normalizarTexto(clave) === aliasNormalizado);

      if (claveEncontrada) {
        return fila[claveEncontrada];
      }
    }

    return '';
  }

  private normalizarTexto(valor: any): string {
    return String(valor || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]/g, '')
      .toLowerCase();
  }

  private tieneDato(valor: any): boolean {
    return valor !== null && valor !== undefined && String(valor).trim() !== '';
  }

  private parsearNumero(valor: any, fallback: number): number {
    if (!this.tieneDato(valor)) {
      return fallback;
    }

    if (typeof valor === 'number') {
      return Number.isFinite(valor) ? valor : fallback;
    }

    const limpio = String(valor)
      .trim()
      .replace(/\./g, '')
      .replace(',', '.')
      .replace(/[^0-9.-]/g, '');

    const numero = Number(limpio);
    return Number.isFinite(numero) ? numero : fallback;
  }

  private parsearBooleanoVigencia(valor: any, fallback: boolean): boolean {
    if (!this.tieneDato(valor)) {
      return fallback;
    }

    const normalizado = this.normalizarTexto(valor);

    if (['1', 'si', 's', 'true', 'activo', 'vigente', 'yes'].includes(normalizado)) {
      return true;
    }

    if (['0', 'no', 'n', 'false', 'inactivo', 'archivado'].includes(normalizado)) {
      return false;
    }

    const numero = Number(normalizado);
    if (Number.isFinite(numero)) {
      return numero > 0;
    }

    return fallback;
  }

  private async obtenerModuloExcel() {
    if (!this.xlsxModulePromise) {
      this.xlsxModulePromise = import('xlsx');
    }

    return this.xlsxModulePromise;
  }

  private async obtenerModuloExcelJs() {
    if (!this.excelJsModulePromise) {
      this.excelJsModulePromise = import('exceljs');
    }

    return this.excelJsModulePromise;
  }
}