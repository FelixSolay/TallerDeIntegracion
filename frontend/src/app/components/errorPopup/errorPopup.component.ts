import { Component, Input } from '@angular/core';
import { ButtonComponent } from '../button/button.component';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-error-popup',
  standalone: true,
  imports: [ ButtonComponent, CommonModule ],
  templateUrl: './errorPopup.component.html',
  styleUrl: './errorPopup.component.css'
})
export class ErrorPopupComponent {
  @Input() text = '';
  @Input() textAux = '';
  @Input() textButton = 'Reintentar';
  @Input() closePopup!: () => void;

  close() {
    this.closePopup();
  }
}
