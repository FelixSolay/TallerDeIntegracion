import { Component, inject, OnInit } from '@angular/core';
import { GlobalService } from '../../services/global.service';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-admin-home',
  standalone: true,
  imports: [ CommonModule ],
  templateUrl: './adminHome.component.html',
  styleUrl: './adminHome.component.css',
})
export class AdminHomeComponent implements OnInit {
  router = inject(Router);

  constructor(private globalService: GlobalService) {}

  ngOnInit(): void {
    this.globalService.checkLoggedIn("/inicioAdministrador");
  }

  navigateTo(route: string): void {
    this.router.navigate([route]);
  }
}