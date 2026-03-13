import { Component, inject } from '@angular/core';
import { NotificationService } from './services/notification.service';

@Component({
  selector: 'app-root', // Este es el selector que suele traer el index.html por defecto
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent {
  readonly notificationService = inject(NotificationService);
}