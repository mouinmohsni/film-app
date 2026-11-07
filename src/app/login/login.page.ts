import { Component } from '@angular/core';
import { AlertController } from '@ionic/angular';
import { Router } from '@angular/router';
import { FirebaseService } from '../services/firebase.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
  standalone: false,
})
export class LoginPage {
  email = '';
  password = '';
  isLoading = false;

  constructor(
    private readonly firebaseService: FirebaseService,
    private readonly alertController: AlertController,
    private readonly router: Router,
  ) {}

  async login(): Promise<void> {
    const email = this.email.trim();

    if (!email || !this.password) {
      await this.showAlert(
        'Champs manquants',
        'Saisis ton adresse e-mail et ton mot de passe.',
      );
      return;
    }

    this.isLoading = true;
    let loginSucceeded = false;

    try {
      await this.firebaseService.login(email, this.password);
      loginSucceeded = true;

      const profile = await this.firebaseService.getProfile();

      if (!profile || profile.isActive !== true) {
        await this.firebaseService.logout();
        loginSucceeded = false;
        this.password = '';

        await this.showAlert(
          'Accès refusé',
          'Ce compte est désactivé ou son profil est indisponible. Contacte un administrateur.',
        );
        return;
      }

      const destination =
        profile.role === 'admin' ? '/admin' : '/home';

      this.email = '';
      this.password = '';

      await this.showAlert(
        'Connexion réussie',
        'Bienvenue dans Films-app.',
      );

      await this.router.navigateByUrl(destination, { replaceUrl: true });
    } catch (error: unknown) {
      console.error('Erreur lors de la connexion :', error);

      // Si l’authentification a réussi mais que la lecture du profil échoue,
      // on ferme la session par précaution.
      if (loginSucceeded && this.firebaseService.auth.currentUser) {
        try {
          await this.firebaseService.logout();
        } catch (logoutError: unknown) {
          console.error(
            'Erreur lors de la fermeture de la session :',
            logoutError,
          );
        }
      }

      const code = (error as { code?: string }).code;

      const message =
        code === 'auth/invalid-credential' ||
        code === 'auth/user-not-found' ||
        code === 'auth/wrong-password'
          ? 'Adresse e-mail ou mot de passe incorrect.'
          : 'La connexion ou la vérification du compte a échoué. Vérifie ta connexion et réessaie.';

      await this.showAlert('Connexion impossible', message);
    } finally {
      this.isLoading = false;
    }
  }

  private async showAlert(header: string, message: string): Promise<void> {
    const alert = await this.alertController.create({
      header,
      message,
      buttons: ['OK'],
    });

    await alert.present();
    await alert.onDidDismiss();
  }
}
