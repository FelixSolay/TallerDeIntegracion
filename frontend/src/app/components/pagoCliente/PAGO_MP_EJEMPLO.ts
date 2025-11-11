/**
 * =====================================================
 * EJEMPLO DE INTEGRACIÓN DE MERCADO PAGO EN FRONTEND
 * =====================================================
 * 
 * Este archivo muestra cómo integrar el pago con QR
 * en tu componente de pago (Angular/TypeScript)
 */

// 1. SERVICIO DE PAGO (pago.service.ts)
// =====================================================

import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class PagoService {
  private apiUrl = 'http://localhost:3000'; // URL del backend

  constructor(private http: HttpClient) { }

  /**
   * Crear preferencia de pago para checkout
   */
  crearPreferenciaPago(datos: {
    orderId: string;
    dni: string;
    items: any[];
    total: number;
  }): Observable<any> {
    return this.http.post(`${this.apiUrl}/pagos/crear-preferencia`, datos);
  }

  /**
   * Generar QR para punto de venta
   */
  generarQR(datos: {
    cantidad: number;
    descripcion: string;
    reference?: string;
    items?: any[];
  }): Observable<any> {
    return this.http.post(`${this.apiUrl}/pagos/generar-qr`, datos);
  }

  /**
   * Obtener información de una preferencia
   */
  obtenerPreferencia(preferenceId: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/pagos/preferencia/${preferenceId}`);
  }

  /**
   * Confirmar pago después de procesarlo
   */
  confirmarPago(datos: {
    orderId: string;
    dni: string;
    paymentId: string;
    preferenceId: string;
    status: string;
  }): Observable<any> {
    return this.http.put(`${this.apiUrl}/pagos/confirmar-pago`, datos);
  }
}

// 2. COMPONENTE DE PAGO CON QR (pago-cliente.component.ts)
// =====================================================

import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
// Nota: PagoService está definido arriba en este mismo archivo
// En tu proyecto real, importa desde: import { PagoService } from '../../services/pago.service';

@Component({
  selector: 'app-pago-cliente',
  templateUrl: './pago-cliente.component.html',
  styleUrls: ['./pago-cliente.component.css']
})
export class PagoClienteComponent implements OnInit {
  
  // Variables de control
  dni: string = '';
  total: number = 0;
  items: any[] = [];
  
  // Estados de pago
  qrCode: string | null = null;
  checkoutUrl: string | null = null;
  cargando: boolean = false;
  error: string | null = null;
  
  // Datos del pago
  preferenceId: string | null = null;
  paymentId: string | null = null;
  paymentStatus: string | null = null;

  constructor(
    private pagoService: PagoService,
    private route: ActivatedRoute,
    private router: Router
  ) { }

  ngOnInit(): void {
    // Obtener parámetros de la URL
    this.route.queryParams.subscribe(params => {
      if (params['preference_id']) {
        this.procesarRetornoMP(params);
      }
    });

    // Cargar datos del pedido
    this.cargarDatosPedido();
  }

  /**
   * Cargar datos del pedido actual
   */
  cargarDatosPedido(): void {
    // Aquí obtendrías los datos del carrito/pedido
    // Por ejemplo:
    this.items = [
      {
        nombre: 'Producto 1',
        precioUnitario: 100,
        cantidad: 2
      },
      {
        nombre: 'Producto 2',
        precioUnitario: 50,
        cantidad: 1
      }
    ];
    
    this.total = this.items.reduce((sum, item) => 
      sum + (item.precioUnitario * item.cantidad), 0
    );
    
    this.dni = localStorage.getItem('userDni') || '';
  }

  /**
   * Generar QR para punto de venta
   */
  generarQRPago(): void {
    this.cargando = true;
    this.error = null;

    const qrData = {
      cantidad: this.total,
      descripcion: `Compra de ${this.items.length} producto(s)`,
      reference: `ORD-${Date.now()}`,
      items: this.items
    };

    this.pagoService.generarQR(qrData).subscribe({
      next: (response: any) => {
        if (response.success) {
          this.qrCode = response.qrCode;
          this.preferenceId = response.preferenceId;
          
          // Mostrar mensaje de éxito
          console.log('✅ QR generado correctamente');
          
          // Opcional: Iniciar polling para verificar pago
          this.verificarEstadoPago();
        }
        this.cargando = false;
      },
      error: (err: any) => {
        this.error = 'Error al generar QR: ' + err.error?.error || err.message;
        this.cargando = false;
      }
    });
  }

  /**
   * Crear preferencia para Checkout Pro de Mercado Pago
   */
  crearPagoCheckout(): void {
    this.cargando = true;
    this.error = null;

    const ordenData = {
      orderId: `ORD-${Date.now()}`,
      dni: this.dni,
      items: this.items,
      total: this.total,
      notificationUrl: `${window.location.origin}/api/pagos/webhook`
    };

    this.pagoService.crearPreferenciaPago(ordenData).subscribe({
      next: (response: any) => {
        if (response.success) {
          this.preferenceId = response.preferenceId;
          this.checkoutUrl = response.checkoutUrl;
          
          // Opción 1: Redirigir directamente
          if (this.checkoutUrl) {
            window.location.href = this.checkoutUrl;
          }
          
          // Opción 2: Abrir en popup
          // window.open(this.checkoutUrl, 'MP-Checkout', 'width=800,height=600');
        }
        this.cargando = false;
      },
      error: (err: any) => {
        this.error = 'Error al crear preferencia: ' + err.error?.error || err.message;
        this.cargando = false;
      }
    });
  }

  /**
   * Verificar estado del pago (Polling)
   */
  verificarEstadoPago(): void {
    if (!this.preferenceId) return;

    const interval = setInterval(() => {
      this.pagoService.obtenerPreferencia(this.preferenceId!).subscribe({
        next: (response: any) => {
          if (response.success) {
            const preference = response.preference;
            
            // Verificar si hay pagos asociados
            if (preference.payments && preference.payments.length > 0) {
              const payment = preference.payments[0];
              this.paymentStatus = payment.status;
              this.paymentId = payment.id;

              if (payment.status === 'approved') {
                clearInterval(interval);
                this.confirmarPago('approved');
              } else if (payment.status === 'rejected') {
                clearInterval(interval);
                this.error = 'El pago fue rechazado';
              }
            }
          }
        },
        error: (err: any) => {
          console.error('Error al verificar estado:', err);
        }
      });
    }, 5000); // Verificar cada 5 segundos

    // Detener después de 5 minutos
    setTimeout(() => clearInterval(interval), 300000);
  }

  /**
   * Confirmar pago en la base de datos
   */
  confirmarPago(status: string): void {
    if (!this.paymentId || !this.preferenceId) {
      this.error = 'Falta información del pago';
      return;
    }

    const pagoData = {
      orderId: 'tu-order-id', // Obtener desde el estado de la app
      dni: this.dni,
      paymentId: this.paymentId,
      preferenceId: this.preferenceId,
      status: status
    };

    this.pagoService.confirmarPago(pagoData).subscribe({
      next: (response: any) => {
        if (response.success) {
          // Redirigir a página de éxito
          this.router.navigate(['/pago-exitoso'], {
            queryParams: { 
              orderId: response.pedido._id,
              preferenceId: this.preferenceId
            }
          });
        }
      },
      error: (err: any) => {
        this.error = 'Error al confirmar pago';
        console.error(err);
      }
    });
  }

  /**
   * Procesar retorno desde Mercado Pago
   */
  procesarRetornoMP(params: any): void {
    const preferenceId = params['preference_id'];
    const merchantOrderId = params['merchant_order_id'];
    const paymentId = params['payment_id'];

    if (paymentId) {
      this.paymentId = paymentId;
      this.preferenceId = preferenceId;
      
      // Verificar estado del pago
      this.verificarEstadoPago();
    }
  }

  /**
   * Cancelar pago
   */
  cancelarPago(): void {
    if (confirm('¿Estás seguro de que deseas cancelar este pago?')) {
      this.router.navigate(['/pago-fallido']);
    }
  }
}

// 3. TEMPLATE HTML (pago-cliente.component.html)
// =====================================================

/*
<div class="pago-container">
  <h1>Método de Pago</h1>

  <!-- Mostrar error -->
  <div *ngIf="error" class="alert alert-danger">
    {{ error }}
  </div>

  <!-- Sección de total -->
  <div class="total-section">
    <h3>Resumen de Compra</h3>
    <div class="items-list">
      <div *ngFor="let item of items" class="item-row">
        <span>{{ item.nombre }}</span>
        <span>x{{ item.cantidad }}</span>
        <span>${{ (item.precioUnitario * item.cantidad).toFixed(2) }}</span>
      </div>
    </div>
    <hr>
    <h4 class="total">Total: ${{ total.toFixed(2) }}</h4>
  </div>

  <!-- Opciones de pago -->
  <div class="pago-options">
    
    <!-- Opción 1: QR para POS -->
    <div class="opcion-pago">
      <h3>Pagar con QR (Punto de Venta)</h3>
      <button 
        [disabled]="cargando || qrCode !== null" 
        (click)="generarQRPago()"
        class="btn btn-primary">
        {{ cargando ? 'Generando QR...' : 'Generar Código QR' }}
      </button>
      
      <div *ngIf="qrCode" class="qr-section">
        <p class="instruction">Escanea este código QR con tu celular para completar el pago</p>
        <img [src]="qrCode" alt="Código QR de pago" class="qr-image">
        <p class="waiting" *ngIf="!paymentStatus">Esperando confirmación del pago...</p>
        <p class="confirmed" *ngIf="paymentStatus === 'approved'">✓ Pago recibido correctamente</p>
        <p class="rejected" *ngIf="paymentStatus === 'rejected'">✗ El pago fue rechazado</p>
      </div>
    </div>

    <!-- Opción 2: Checkout Pro -->
    <div class="opcion-pago">
      <h3>Pagar con Checkout Pro</h3>
      <button 
        [disabled]="cargando" 
        (click)="crearPagoCheckout()"
        class="btn btn-success">
        {{ cargando ? 'Procesando...' : 'Ir al Pago' }}
      </button>
    </div>

  </div>

  <!-- Botón de cancelar -->
  <button (click)="cancelarPago()" class="btn btn-cancel">
    Cancelar
  </button>
</div>
*/

// 4. CSS (pago-cliente.component.css)
// =====================================================

/*
.pago-container {
  max-width: 600px;
  margin: 40px auto;
  padding: 20px;
  border: 1px solid #ddd;
  border-radius: 8px;
}

.alert {
  padding: 12px;
  border-radius: 4px;
  margin-bottom: 20px;
}

.alert-danger {
  background-color: #f8d7da;
  color: #721c24;
  border: 1px solid #f5c6cb;
}

.total-section {
  background-color: #f9f9f9;
  padding: 15px;
  border-radius: 4px;
  margin-bottom: 30px;
}

.items-list {
  margin: 15px 0;
}

.item-row {
  display: flex;
  justify-content: space-between;
  padding: 8px 0;
  border-bottom: 1px solid #eee;
}

.total {
  font-size: 20px;
  font-weight: bold;
  color: #28a745;
  margin-top: 15px;
}

.pago-options {
  display: flex;
  gap: 20px;
  flex-direction: column;
  margin-bottom: 30px;
}

.opcion-pago {
  border: 1px solid #dee2e6;
  padding: 20px;
  border-radius: 8px;
  text-align: center;
}

.btn {
  padding: 10px 20px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 16px;
  margin-top: 10px;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-primary {
  background-color: #007bff;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background-color: #0056b3;
}

.btn-success {
  background-color: #28a745;
  color: white;
}

.btn-success:hover:not(:disabled) {
  background-color: #218838;
}

.btn-cancel {
  background-color: #dc3545;
  color: white;
  width: 100%;
}

.qr-section {
  margin-top: 20px;
  padding: 20px;
  background-color: #f0f0f0;
  border-radius: 4px;
}

.qr-image {
  max-width: 300px;
  height: auto;
  margin: 15px 0;
  border: 2px solid #ddd;
  padding: 10px;
  background: white;
}

.instruction {
  font-size: 14px;
  color: #666;
  margin-bottom: 10px;
}

.waiting {
  color: #ffc107;
  font-weight: bold;
  margin-top: 10px;
}

.confirmed {
  color: #28a745;
  font-weight: bold;
  margin-top: 10px;
}

.rejected {
  color: #dc3545;
  font-weight: bold;
  margin-top: 10px;
}
*/
