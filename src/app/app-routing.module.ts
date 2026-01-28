import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { BuscarCancionesComponent } from './buscar-canciones/buscar-canciones.component';

const routes: Routes = [
  { 
    path: 'mesa/:id', 
    component: BuscarCancionesComponent 
  },
  { 
    path: '', 
    redirectTo: 'mesa/default', 
    pathMatch: 'full' 
  }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }