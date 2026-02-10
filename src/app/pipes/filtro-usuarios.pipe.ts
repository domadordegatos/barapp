import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'filtroUsuarios'
})
export class FiltroUsuariosPipe implements PipeTransform {
  transform(usuarios: any[], texto: string): any[] {
    if (!texto || texto.trim() === '') {
      return usuarios;
    }
    const search = texto.toLowerCase().trim();
    return usuarios.filter(u => 
      u.nombreBar.toLowerCase().includes(search) || 
      u.correo.toLowerCase().includes(search)
    );
  }
}