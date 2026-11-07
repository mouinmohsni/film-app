import { Component, OnDestroy, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { onAuthStateChanged } from 'firebase/auth';
import type { Unsubscribe as AuthUnsubscribe } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import type { Unsubscribe as FirestoreUnsubscribe } from 'firebase/firestore';

import { FirebaseService } from './services/firebase.service';
import type { UserProfile } from './services/firebase.service';
import { ThemeService } from './services/theme.service';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
  standalone: false,
})
export class AppComponent implements OnInit, OnDestroy {
  isAuthenticated = signal(false);
  isAdmin = signal(false);

  private stopAuthListener?: AuthUnsubscribe;
  private stopProfileListener?: FirestoreUnsubscribe;
  private blockingUserId: string | null = null;

  constructor(
    private readonly themeService: ThemeService,
    private readonly firebaseService: FirebaseService,
    private readonly router: Router,
  ) {
    this.themeService.initializeTheme();
  }

  ngOnInit(): void {

    // pour verifier si il ya une connexion

    this.stopAuthListener = onAuthStateChanged(
      this.firebaseService.auth,
      (user) => {
        this.stopProfileListener?.();
        this.stopProfileListener = undefined;

        this.isAuthenticated.set(false);
        this.isAdmin.set(false);

        if (!user) {
          return;
        }
        //verifier si le compte est active
        const userId = user.uid;
        const profileRef = doc(this.firebaseService.db, 'users', userId);

        this.stopProfileListener = onSnapshot(
          profileRef,
          (snapshot) => {
            if (this.firebaseService.auth.currentUser?.uid !== userId) {
              return;
            }

            if (!snapshot.exists()) {
              void this.endSession(userId);
              return;
            }

            const profile = snapshot.data() as UserProfile;

            if (profile.isActive !== true) {
              void this.endSession(userId);
              return;
            }
           // verifier le role
            this.isAuthenticated.set(true);
            this.isAdmin.set(profile.role === 'admin');
          },
          (error: unknown) => {
            console.error(
              'Impossible de vérifier le statut du compte :',
              error,
            );

            void this.endSession(userId);
          },
        );
      },
    );
  }

  ngOnDestroy(): void {
    this.stopAuthListener?.();
    this.stopProfileListener?.();
  }
 // verfier  et eviter une connexion repete
  private async endSession(userId: string): Promise<void> {
    if (
      this.blockingUserId === userId ||
      this.firebaseService.auth.currentUser?.uid !== userId
    ) {
      return;
    }

    this.blockingUserId = userId;
    this.isAuthenticated.set(false);
    this.isAdmin.set(false);

    try {
      await this.firebaseService.logout();
      await this.router.navigateByUrl('/login', { replaceUrl: true });
    } catch (error: unknown) {
      console.error('Erreur lors de la fermeture de la session :', error);
    } finally {
      this.blockingUserId = null;
    }
  }

  async logout(): Promise<void> {
    try {
      await this.firebaseService.logout();
      await this.router.navigateByUrl('/login', { replaceUrl: true });
    } catch (error: unknown) {
      console.error('Erreur lors de la déconnexion :', error);
    }
  }
}
