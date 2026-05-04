import { Component, HostListener, OnDestroy, OnInit } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule } from '@angular/common';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';

export interface SuperUserMenuItem {
  path: string;
  label: string;
}

@Component({
  selector: 'app-menu-bar',
  imports: [
    CommonModule,
    RouterLink,
    RouterLinkActive,
    NzButtonModule,
    NzIconModule,
  ],
  templateUrl: './menu-bar.html',
  styleUrl: './menu-bar.css',
})
export class MenuBar {
  /** Dynamic menu items – add or remove entries to change the super user nav. */
  menuItems: SuperUserMenuItem[] = [
    { path: 'TradeHelper', label: 'Trade Helper' },
  ];

  /** Mobile menu open state (hamburger overlay). */
  menuOpen = false;

  private routerSub?: Subscription;

  constructor(
    private _Router: Router,
  ) { }

  ngOnInit(): void {
    this.routerSub = this._Router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe(() => this.closeMenu());
  }

  ngOnDestroy(): void {
    this.routerSub?.unsubscribe();
    this.setBodyScrollLock(false);
  }

  @HostListener('window:resize')
  onResize(): void {
    if (window.innerWidth > 768) {
      this.closeMenu();
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.menuOpen) {
      this.closeMenu();
    }
  }

  getSuperUserBasePath(): string {
    return '/SuperUser';
  }

  toggleMenu(): void {
    this.menuOpen = !this.menuOpen;
    this.setBodyScrollLock(this.menuOpen);
  }

  closeMenu(): void {
    this.menuOpen = false;
    this.setBodyScrollLock(false);
  }

  private setBodyScrollLock(lock: boolean): void {
    document.body.style.overflow = lock ? 'hidden' : '';
  }
}
