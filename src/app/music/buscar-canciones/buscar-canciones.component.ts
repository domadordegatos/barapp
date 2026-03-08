import { Component, OnInit, Input, OnChanges, SimpleChanges } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { RockolaService } from '../../services/rockola.service';
import { SpotifyService } from '../../services/spotify-auth.service';
import { Observable, Subject, of } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap, map, take } from 'rxjs/operators';
import { trigger, transition, style, animate, query, stagger } from '@angular/animations';

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
  styleUrls: ['./buscar-canciones.component.scss'],
  animations: [
    trigger('listaResultados', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(-20px)' }),
        animate('300ms cubic-bezier(0.4, 0, 0.2, 1)', style({ opacity: 1, transform: 'translateY(0)' }))
      ]),
      transition(':leave', [
        animate('200ms ease-in', style({ opacity: 0, transform: 'translateY(-10px)' }))
      ])
    ]),
    trigger('itemAnim', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateX(-10px)' }),
        animate('200ms {{delay}}ms ease-out', style({ opacity: 1, transform: 'translateX(0)' }))
      ], { params: { delay: 0 } })
    ])
  ]
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

  solicitudParaEliminar: any = null;
  mostrandoModalCancelacion: boolean = false;
  eliminandoSolicitud: boolean = false;
  idSiendoEliminado: string | null = null;

  // GESTIÓN DE SWIPE (TOUCH + MOUSE)
  startX: number = 0;
  currentX: number = 0;
  solicitudEnAccion: any = null;
  isDragging: boolean = false; // Bandera para diferenciar clic de arrastre

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
          const tA = a.fechaHora?.seconds || 0;
          const tB = b.fechaHora?.seconds || 0;
          return tB - tA;
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
      const tutorialVisto = sessionStorage.getItem('tutorial_delete_visto');
      if (!tutorialVisto) {
        this.idNuevaCancion = idNueva; 
        sessionStorage.setItem('tutorial_delete_visto', 'true');
        setTimeout(() => this.idNuevaCancion = null, 3000);
      }
      this.query = ''; this.tracks = []; this.cancelarSolicitud();
    } catch { alert("Error al enviar."); }
    finally { this.enviandoSolicitud = false; }
  }

  obtenerArtistas(track: Track): string { return track.artists.map(a => a.name).join(', '); }

  // --- GESTIÓN DE SWIPE (TOUCH) ---
  onTouchStart(event: TouchEvent, solicitud: any) {
    if (solicitud.estado !== 'pendiente' || this.idSiendoEliminado) return;
    this.startX = event.touches[0].clientX;
    this.solicitudEnAccion = solicitud;
    this.isDragging = true;
  }

  onTouchMove(event: TouchEvent) {
    if (!this.solicitudEnAccion || this.idSiendoEliminado || !this.isDragging) return;
    const x = event.touches[0].clientX;
    this.handleMove(x);
  }

  onTouchEnd() {
    this.handleEnd();
  }

  // --- GESTIÓN DE SWIPE (MOUSE) ---
  onMouseDown(event: MouseEvent, solicitud: any) {
    if (solicitud.estado !== 'pendiente' || this.idSiendoEliminado) return;
    this.startX = event.clientX;
    this.solicitudEnAccion = solicitud;
    this.isDragging = true;
  }

  onMouseMove(event: MouseEvent) {
    if (!this.solicitudEnAccion || this.idSiendoEliminado || !this.isDragging) return;
    // Evitamos seleccionar texto al arrastrar
    event.preventDefault(); 
    const x = event.clientX;
    this.handleMove(x);
  }

  onMouseUp() {
    this.handleEnd();
  }

  onMouseLeave() {
    if (this.isDragging) {
        this.handleEnd();
    }
  }

  // --- LÓGICA COMÚN ---
  private handleMove(currentClientX: number) {
    const walk = currentClientX - this.startX;
    if (walk < 0 && walk > -120) {
      this.currentX = walk;
    }
  }

  private handleEnd() {
    if (!this.solicitudEnAccion) return;

    if (this.currentX < -70) {
      this.abrirModalCancelacion(this.solicitudEnAccion);
    } else {
      this.currentX = 0;
      this.solicitudEnAccion = null;
    }
    this.isDragging = false;
  }

  getTransform(solicitudId: string) {
    if (this.idSiendoEliminado === solicitudId) return `translateX(-150%)`; // Animación de salida
    // Solo si el usuario está interactuando activamente
    if (this.solicitudEnAccion?.id === solicitudId) {
      return `translateX(${this.currentX}px)`;
    }
    return null; // Deja que el CSS controle el tutorial y el reposo
  }

  abrirModalCancelacion(solicitud: any) {
    this.solicitudParaEliminar = solicitud;
    this.mostrandoModalCancelacion = true;
    this.currentX = -80; 
  }

  cerrarModalCancelacion() {
    this.mostrandoModalCancelacion = false;
    this.solicitudParaEliminar = null;
    this.solicitudEnAccion = null;
    this.currentX = 0;
    this.idSiendoEliminado = null;
  }

  async confirmarEliminacion() {
    if (!this.solicitudParaEliminar || this.eliminandoSolicitud) return;
    
    this.eliminandoSolicitud = true;
    const idABorrar = this.solicitudParaEliminar.id;
    this.mostrandoModalCancelacion = false;
    
    setTimeout(() => {
      this.idSiendoEliminado = idABorrar;
      setTimeout(async () => {
        try {
          await this.rockolaService.eliminarSolicitud(this.nombreBarUrl, idABorrar);
        } catch (e) {
          console.error(e);
        } finally {
          this.idSiendoEliminado = null;
          this.solicitudParaEliminar = null;
          this.solicitudEnAccion = null;
          this.eliminandoSolicitud = false;
          this.currentX = 0;
        }
      }, 1000); 
    }, 500); 
  }

  async eliminarCancion(solicitud: any) {
     this.abrirModalCancelacion(solicitud);
  }
}
