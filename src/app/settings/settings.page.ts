import {
  Component,
  OnDestroy,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { onAuthStateChanged } from 'firebase/auth';
import type { Unsubscribe } from 'firebase/auth';
import { FirebaseService } from '../services/firebase.service';
import { ThemeService } from '../services/theme.service';

@Component({
  selector: 'app-settings',
  templateUrl: './settings.page.html',
  styleUrls: ['./settings.page.scss'],
  standalone: false,
})
export class SettingsPage implements OnInit, OnDestroy {
  private readonly themeService = inject(ThemeService);
  private readonly firebaseService = inject(FirebaseService);

  darkMode = true;

  isAuthenticated = signal(false);
  authReady = signal(false);
  matchingEnabled = signal(false);
  isMatchingLoading = signal(true);
  isMatchingSaving = signal(false);
  matchingMessage = signal('');

  private stopAuthListener?: Unsubscribe;

  ngOnInit(): void {
    this.darkMode = this.themeService.isDarkMode();

    this.stopAuthListener = onAuthStateChanged(
      this.firebaseService.auth,
      (user) => {
        this.authReady.set(true);
        this.isAuthenticated.set(!!user);
        this.matchingMessage.set('');

        if (user) {
          void this.loadMatchingPreference();
        } else {
          this.matchingEnabled.set(false);
          this.isMatchingLoading.set(false);
        }
      },
    );
  }

  ngOnDestroy(): void {
    this.stopAuthListener?.();
  }

  onThemeChange(event: CustomEvent<{ checked: boolean }>): void {
    this.darkMode = event.detail.checked;
    this.themeService.setDarkMode(this.darkMode);
  }

  async loadMatchingPreference(): Promise<void> {
    this.isMatchingLoading.set(true);

    try {
      const enabled = await this.firebaseService.getMatchingEnabled();
      this.matchingEnabled.set(enabled);
    } catch (error: unknown) {
      console.error('Erreur lors du chargement du réglage matching :', error);
      this.matchingMessage.set(
        'Impossible de charger le réglage de participation.',
      );
    } finally {
      this.isMatchingLoading.set(false);
    }
  }

  async onMatchingChange(
    event: CustomEvent<{ checked: boolean }>,
  ): Promise<void> {
    if (!this.isAuthenticated() || this.isMatchingSaving()) {
      return;
    }

    const previousValue = this.matchingEnabled();
    const newValue = event.detail.checked;

    this.matchingEnabled.set(newValue);
    this.isMatchingSaving.set(true);
    this.matchingMessage.set('');

    try {
      await this.firebaseService.setMatchingEnabled(newValue);

      this.matchingMessage.set(
        newValue
          ? 'Participation activée : ton nom, ton prénom, ta photo si présente et un résumé de tes goûts sont partagés avec les participants.'
          : 'Participation désactivée : ton profil partagé a été retiré.',
      );
    } catch (error: unknown) {
      console.error('Erreur lors de la mise à jour du matching :', error);
      this.matchingEnabled.set(previousValue);

      const errorCode = error instanceof Error ? error.message : '';

      this.matchingMessage.set(
        errorCode === 'MATCHING_REQUIRES_THREE_FAVORITES'
          ? 'Ajoute au moins 3 films à tes favoris avant d’activer le matching.'
          : 'Impossible de mettre à jour le matching. Vérifie ta connexion et les règles Firestore.',
      );
    } finally {
      this.isMatchingSaving.set(false);
    }

  }
}
