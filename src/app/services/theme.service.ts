import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class ThemeService {
  // Clé utilisée pour mémoriser le thème choisi dans le navigateur.
  private readonly storageKey = 'films-ionic-theme';
  private darkMode = true;

  initializeTheme(): void {
    const savedTheme = window.localStorage.getItem(this.storageKey);

    // Le mode sombre est utilisé par défaut si aucun choix n’est enregistré.
    this.darkMode = savedTheme === null || savedTheme === 'dark';
    this.applyTheme();
  }

  setDarkMode(enabled: boolean): void {
    this.darkMode = enabled;

    // Mémorise le choix pour les prochaines visites.
    window.localStorage.setItem(
      this.storageKey,
      enabled ? 'dark' : 'light',
    );

    this.applyTheme();
  }

  isDarkMode(): boolean {
    return this.darkMode;
  }

  private applyTheme(): void {
    // Active ou retire la classe Ionic du mode sombre sur toute l’application.
    document.documentElement.classList.toggle(
      'ion-palette-dark',
      this.darkMode,
    );
  }
}
