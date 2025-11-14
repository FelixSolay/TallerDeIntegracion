import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-confirm-popup',
  standalone: true,
  imports: [ CommonModule ],
  templateUrl: './confirmPopup.component.html',
  styleUrl: './confirmPopup.component.css'
})
export class ConfirmPopupComponent {
  @Input() title = '¿Confirmar acción?';
  @Input() message = '';
  @Input() confirmText = 'Confirmar';
  @Input() cancelText = 'Cancelar';
  @Input() onConfirm!: () => void;
  @Input() onCancel!: () => void;

  confirm() {
    this.onConfirm();
  }

  cancel() {
    this.onCancel();
  }
}
