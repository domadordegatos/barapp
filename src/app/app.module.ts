// ... otras importaciones
import { AngularFireModule } from '@angular/fire/compat';
import { AngularFirestoreModule } from '@angular/fire/compat/firestore';
import { environment } from '../environments/environment';
import { AppComponent } from './app.component';
import { BuscarCancionesComponent } from './music/buscar-canciones/buscar-canciones.component';
import { BrowserModule } from '@angular/platform-browser';
import { AppRoutingModule } from './app-routing.module';
import { HttpClientModule } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { NgModule } from '@angular/core';
import { AdminPedidosComponent } from './music/admin-pedidos/admin-pedidos.component';
import { RegistroAdminComponent } from './auth/registro-admin/registro-admin.component';
import { LoginComponent } from './auth/login/login.component';
import { SuperAdminComponent } from './auth/super-admin/super-admin.component';
import { FiltroUsuariosPipe } from './pipes/filtro-usuarios.pipe';
import { GestionMusicaComponent } from './music/gestion-music/gestion-music.component';
import { GestionProductosComponent } from './productos/gestion-productos/gestion-productos.component';
import { FiltroProductosPipe } from './pipes/filtro-productos.pipe';
import { DashboardMesaComponent } from './dashboard-mesa/dashboard-mesa.component';
import { ListaProductosComponent } from './lista-productos/lista-productos.component';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';

@NgModule({
  declarations: [
    AppComponent, 
    BuscarCancionesComponent, AdminPedidosComponent, RegistroAdminComponent, LoginComponent, SuperAdminComponent, FiltroUsuariosPipe, GestionMusicaComponent, GestionProductosComponent, FiltroProductosPipe, DashboardMesaComponent, ListaProductosComponent // Ahora que no son standalone, Angular no protestará aquí
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    HttpClientModule,
    FormsModule,
    AngularFireModule.initializeApp(environment.firebase),
    AngularFirestoreModule,
    BrowserAnimationsModule
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }