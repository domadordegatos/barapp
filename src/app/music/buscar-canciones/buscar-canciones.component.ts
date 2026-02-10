import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { RockolaService } from '../../services/rockola.service';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, Subject, firstValueFrom } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';

export interface Track {
  id: string;
  name: string;
  artists: { name: string }[];
  album: { images: { url: string }[] };
  uri: string;
}

@Component({
  selector: 'app-buscar-canciones',
  templateUrl: './buscar-canciones.component.html',
  styleUrls: ['./buscar-canciones.component.scss']
})
export class BuscarCancionesComponent implements OnInit {
  // Variables de URL
  nombreBarUrl: string = '';
  idMesaUrl: string = '';
  numeroMesaReal: number | null = null; // Nueva variable

  nombreBarReal: string = ''; // El nombre bonito (ej: "La Chula")
  barValido: boolean = false;
  errorMensaje: string = '';

  // Control de Acceso
  codigoIngresado: string = '';
  accesoAutorizado: boolean = false;
  cargandoValidacion: boolean = true;

  // Buscador
  query: string = '';
  tracks: Track[] = [];
  private buscador$ = new Subject<string>();
  misCanciones$: Observable<any[]> | null = null;

  constructor(
    private route: ActivatedRoute,
    private rockolaService: RockolaService,
    private http: HttpClient
  ) {}

async ngOnInit() {
  // 1. Capturar y limpiar el parámetro de la URL
  // Si el usuario escribe "la%20chula" o "La-Chula", lo normalizamos
  const parametroUrl = this.route.snapshot.paramMap.get('nombreBar') || '';
  this.nombreBarUrl = parametroUrl.toLowerCase().trim().replace(/\s+/g, ''); 
  this.idMesaUrl = this.route.snapshot.paramMap.get('idMesa') || '';

  // 2. Verificar existencia del bar en Firestore
  await this.verificarExistenciaDelBar();

  // 3. Configurar buscador (solo si el bar es válido)
  if (this.barValido) {
    await this.obtenerDatosDeLaMesa(); // Nueva llamada
    this.buscador$.pipe(
      debounceTime(400),
      distinctUntilChanged()
    ).subscribe(texto => this.ejecutarBusqueda(texto));

    await this.verificarSesionExistente();
  }
  
  this.cargandoValidacion = false;
}

async obtenerDatosDeLaMesa() {
  const datosMesa = await this.rockolaService.obtenerDatosMesa(this.idMesaUrl);
  if (datosMesa) {
    this.numeroMesaReal = datosMesa.numero;
  }
}

async verificarExistenciaDelBar() {
  try {
    // Forzamos el tipo a 'any' para evitar el error de "unknown"
    const datosBar: any = await this.rockolaService.verificarExistenciaBar(this.nombreBarUrl);
    
    if (datosBar) {
      this.barValido = true;
      // Ahora sí podemos acceder sin error
      this.nombreBarReal = datosBar.nombreBar; 
    } else {
      this.barValido = false;
      this.errorMensaje = `El establecimiento "${this.nombreBarUrl}" no existe.`;
    }
  } catch (error) {
    this.barValido = false;
    this.errorMensaje = "Error de conexión con el servidor.";
  }
}

  async verificarSesionExistente() {
    const storageKey = `codigo_${this.nombreBarUrl.toLowerCase()}`;
    const codigoGuardado = localStorage.getItem(storageKey);
    
    if (codigoGuardado) {
      const esValido = await this.rockolaService.validarCodigoBar(this.nombreBarUrl, codigoGuardado);
      if (esValido) {
        this.accesoAutorizado = true;
        this.cargarMisPedidos();
      } else {
        localStorage.removeItem(storageKey);
      }
    }
  }

  async validarAcceso() {
    if (this.codigoIngresado.length !== 4) return;
    
    const esValido = await this.rockolaService.validarCodigoBar(this.nombreBarUrl, this.codigoIngresado);
    if (esValido) {
      localStorage.setItem(`codigo_${this.nombreBarUrl.toLowerCase()}`, this.codigoIngresado);
      this.accesoAutorizado = true;
      this.cargarMisPedidos();
    } else {
      alert("Código incorrecto. Pídelo a tu mesero.");
      this.codigoIngresado = '';
    }
  }

cargarMisPedidos() {
  this.misCanciones$ = this.rockolaService.obtenerMisSolicitudes(this.nombreBarUrl, this.idMesaUrl);
}

  onSearchChange() {
    const busqueda = this.query.trim();
    if (busqueda.length >= 3) {
      this.buscador$.next(busqueda);
    } else {
      this.tracks = [];
    }
  }

  private ejecutarBusqueda(termino: string) {
    const token = 'BQBDAw08kAd5T7cW1p3JswnTKkm27t1IKqathvgcQIHaRfmRx0geL4pIjLANWh3iZxiUmSEhzwWbHE7f84euygnpyR-j4-U8S27HeNxbEz-v5nDk3xSU4PuCm75O_HilE3Bej-97VGDOLR4cj9CGP1EtoHUivLuCcfeJqpi44BSxXsscgaL8UXGs6xBP_zyJPt2wDAETAxx4wA3B6_HykXZYjsVzlfkpjDLwss4JlMrxmmH-2MLQlLA-mfrU9_TUe5jjLc7eMf02UozRqdKiGofE8qviIHsj7kGJCQ9nQZh_yC3tiBmIUVrncO2Q2gJoftVX'; // Recuerda que este token debe ser dinámico en producción
    const url = `https://api.spotify.com/v1/search?q=${encodeURIComponent(termino)}&type=track&limit=10`;
    
    const headers = new HttpHeaders({ 'Authorization': `Bearer ${token}` });

    this.http.get<any>(url, { headers }).subscribe({
      next: (res) => this.tracks = res.tracks.items,
      error: (err) => console.error("Error Spotify:", err)
    });
  }
// buscar-canciones.component.ts

async seleccionarCancion(track: Track) {
  try {
    const storageKey = `codigo_${this.nombreBarUrl.toLowerCase()}`;
    const codigoGuardado = localStorage.getItem(storageKey);
    const esValido = await this.rockolaService.validarCodigoBar(this.nombreBarUrl, codigoGuardado || '');

    if (!esValido) {
      alert("El código del bar ha cambiado.");
      localStorage.removeItem(storageKey);
      this.accesoAutorizado = false;
      return;
    }

    // ENVIAMOS: track, nombreBar, ID_TECNICO, NUMERO_REAL
    await this.rockolaService.enviarSolicitud(
      track, 
      this.nombreBarUrl, 
      this.idMesaUrl,            // F32KPWVCP6
      this.numeroMesaReal || '?' // 1
    );
    
    alert(`¡"${track.name}" enviada!`);
    this.query = '';
    this.tracks = [];
    
  } catch (error) {
    console.error("Error al enviar:", error);
  }
}

  obtenerArtistas(track: Track): string {
    return track.artists.map(a => a.name).join(', ');
  }
}