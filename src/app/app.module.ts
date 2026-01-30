// ... otras importaciones
import { AngularFireModule } from '@angular/fire/compat';
import { AngularFirestoreModule } from '@angular/fire/compat/firestore';
import { environment } from '../environments/environment';
import { AppComponent } from './app.component';
import { BuscarCancionesComponent } from './buscar-canciones/buscar-canciones.component';
import { BrowserModule } from '@angular/platform-browser';
import { AppRoutingModule } from './app-routing.module';
import { HttpClientModule } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { NgModule } from '@angular/core';
import { AdminPedidosComponent } from './admin-pedidos/admin-pedidos.component';
import { RegistroAdminComponent } from './registro-admin/registro-admin.component';
import { LoginComponent } from './login/login.component';

@NgModule({
  declarations: [
    AppComponent, 
    BuscarCancionesComponent, AdminPedidosComponent, RegistroAdminComponent, LoginComponent // Ahora que no son standalone, Angular no protestará aquí
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    HttpClientModule,
    FormsModule,
    AngularFireModule.initializeApp(environment.firebase),
    AngularFirestoreModule
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }