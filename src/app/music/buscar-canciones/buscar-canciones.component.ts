import { Component, OnInit, Input, OnChanges, SimpleChanges } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { RockolaService } from '../../services/rockola.service';
import { SpotifyService } from '../../services/spotify-auth.service';
import { Observable, Subject, of } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap, map } from 'rxjs/operators';

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
export class BuscarCancionesComponent implements OnInit, OnChanges {
  @Input() nombreBarUrl: string = '';
  @Input() idMesaUrl: string = '';
  @Input() numeroMesaReal: number | null = null;
  @Input() nombreBarReal: string = ''; 

  barValido: boolean = false;
  accesoAutorizado: boolean = false;
  cargandoValidacion: boolean = true;
  query: string = '';
  tracks: Track[] = [];
  private buscador$ = new Subject<string>();
  misCanciones$: Observable<any[]> | null = null;
  trackSeleccionado: Track | null = null;
  mostrandoModal: boolean = false;
  enviandoSolicitud: boolean = false;
  idNuevaCancion: string | null = null;

  // --- GESTIÓN DE SWIPE ---
  startX: number = 0;
  currentX: number = 0;
  swipingId: string | null = null;

  constructor(
    private route: ActivatedRoute,
    private rockolaService: RockolaService,
    private spotifyService: SpotifyService
  ) {}

  get storageKey(): string { return `codigo_${this.nombreBarUrl.toLowerCase()}_${this.idMesaUrl}`; }

  async ngOnInit() {
    if (this.nombreBarUrl) {
      await this.verificarExistenciaDelBar();
      if (this.barValido) {
        this.configurarBuscador();
        await this.verificarSesionExistente();
      }
    }
    this.cargandoValidacion = false;
  }

  ngOnChanges(changes: SimpleChanges) {
    if ((changes['nombreBarUrl'] || changes['idMesaUrl']) && this.nombreBarUrl && this.idMesaUrl) {
      this.cargarMisPedidos();
    }
  }

  configurarBuscador() {
    this.buscador$.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      switchMap(texto => (!texto || texto.length < 3) ? of([]) : this.spotifyService.buscarTracks(texto))
    ).subscribe({
      next: (canciones: any) => this.tracks = canciones,
      error: (err) => console.error(err)
    });
  }

  async verificarExistenciaDelBar() {
    try {
      const datosBar: any = await this.rockolaService.verificarExistenciaBar(this.nombreBarUrl);
      if (datosBar) { this.barValido = true; this.nombreBarReal = datosBar.nombreBar; }
    } catch { this.barValido = false; }
  }

  async verificarSesionExistente() {
    const codigoGuardado = localStorage.getItem(this.storageKey);
    if (codigoGuardado) {
      const esValido = await this.rockolaService.validarCodigoBar(this.nombreBarUrl, codigoGuardado);
      if (esValido) { this.accesoAutorizado = true; this.cargarMisPedidos(); }
      else localStorage.removeItem(this.storageKey);
    }
  }

  cargarMisPedidos() {
    this.misCanciones$ = this.rockolaService.obtenerMisSolicitudes(this.nombreBarUrl, this.idMesaUrl).pipe(
      map((canciones: any[]) => { 
        return canciones.sort((a: any, b: any) => {
          if (a.estado === 'pendiente' && b.estado !== 'pendiente') return -1;
          if (a.estado !== 'pendiente' && b.estado === 'pendiente') return 1;
          return (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0);
        });
      })
    );
  }

  onSearchChange() {
    const busqueda = this.query.trim();
    if (busqueda.length === 0) { this.tracks = []; this.buscador$.next(''); return; }
    if (busqueda.length >= 3) this.buscador$.next(busqueda);
  }

  abrirConfirmacion(track: Track) { this.trackSeleccionado = track; this.mostrandoModal = true; }
  cancelarSolicitud() { this.trackSeleccionado = null; this.mostrandoModal = false; }

  async confirmarSolicitud() {
    if (!this.trackSeleccionado || this.enviandoSolicitud) return;
    this.enviandoSolicitud = true;
    try {
      const idNueva: string = await this.rockolaService.enviarSolicitud(this.trackSeleccionado, this.nombreBarUrl, this.idMesaUrl, this.numeroMesaReal || 0);
      const tutorialVisto = localStorage.getItem('tutorial_delete_visto');
      if (!tutorialVisto) {
        this.idNuevaCancion = idNueva; 
        localStorage.setItem('tutorial_delete_visto', 'true');
        setTimeout(() => this.idNuevaCancion = null, 3000);
      }
      this.query = ''; this.tracks = []; this.cancelarSolicitud();
    } catch { alert("Error al enviar."); }
    finally { this.enviandoSolicitud = false; }
  }

  obtenerArtistas(track: Track): string { return track.artists.map(a => a.name).join(', '); }

  // --- LÓGICA DE GESTOS (TOUCH) ---

  onTouchStart(event: TouchEvent, solicitud: any) {
    if (solicitud.estado !== 'pendiente') return;
    this.startX = event.touches[0].clientX;
    this.swipingId = solicitud.id;
  }

  onTouchMove(event: TouchEvent) {
    if (!this.swipingId) return;
    const x = event.touches[0].clientX;
    const walk = x - this.startX;
    // Solo permitimos deslizar hacia la izquierda y hasta un máximo de 80px
    if (walk < 0 && walk > -120) {
      this.currentX = walk;
    }
  }

  onTouchEnd() {
    // Si deslizó más de 70px hacia la izquierda, disparamos la eliminación
    if (this.currentX < -70) {
      const solicitud = { id: this.swipingId, estado: 'pendiente' };
      this.eliminarCancion(solicitud);
    }
    // Reseteamos
    this.swipingId = null;
    this.currentX = 0;
  }

  getTransform(solicitudId: string) {
    if (this.swipingId === solicitudId) {
      return `translateX(${this.currentX}px)`;
    }
    return 'translateX(0)';
  }

  async eliminarCancion(solicitud: any) {
    if (solicitud.estado !== 'pendiente') return;
    if (confirm('¿Quieres cancelar esta solicitud?')) {
       try { await this.rockolaService.eliminarSolicitud(this.nombreBarUrl, solicitud.id); }
       catch (e) { console.error(e); }
    }
  }
}
