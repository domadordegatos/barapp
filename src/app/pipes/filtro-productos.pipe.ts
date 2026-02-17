import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'filtroProductos'
})
export class FiltroProductosPipe implements PipeTransform {
  transform(productos: any[] | null, busqueda: string): any[] {
    if (!productos) return [];
    
    // 1. Filtrado por texto
    let filtrados = productos;
    if (busqueda) {
      const term = busqueda.toLowerCase();
      filtrados = productos.filter(p => 
        p.nombre.toLowerCase().includes(term) ||
        p.categoria.toLowerCase().includes(term) ||
        p.precio.toString().includes(term)
      );
    }

    // 2. Ordenamiento: Los 'visible: true' primero, los 'visible: false' al final
    return filtrados.sort((a, b) => {
      if (a.visible === b.visible) return 0;
      return a.visible ? -1 : 1;
    });
  }
}