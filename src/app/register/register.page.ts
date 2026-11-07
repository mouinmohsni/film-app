import { Component } from '@angular/core';
import { AlertController } from '@ionic/angular';
import { FirebaseService } from '../services/firebase.service';
import { Router } from '@angular/router';


@Component({
  selector: 'app-register',
  templateUrl: './register.page.html',
  styleUrls: ['./register.page.scss'],
  standalone: false,
})
export class RegisterPage {
  email = '';
  password = '';
  confirmPassword = '';
  isLoading = false;
  nom = '';
  prenom = '';
  age: string | number = '';



  constructor(
    private firebaseService: FirebaseService,
    private alertController: AlertController,
    private router: Router,
  ) {}

  async register(): Promise<void> {
    const nom = this.nom.trim();
    const prenom = this.prenom.trim();
    const email = this.email.trim();
    const ageValue = String(this.age ?? '').trim();
    const age = Number(ageValue);


    if (
      !nom ||
      !prenom ||
      !ageValue  ||
      !email ||
      !this.password ||
      !this.confirmPassword
    ) {
      await this.showAlert('Champs manquants', 'Remplis tous les champs.');
      return;
    }

    if (!Number.isInteger(age) || age < 1 || age > 120) {
      await this.showAlert(
        'Âge invalide',
        'Saisis un âge entier compris entre 1 et 120.',
      );
      return;
    }

    if (nom.length > 60 || prenom.length > 60) {
      await this.showAlert(
        'Nom trop long',
        'Le nom et le prénom doivent contenir au maximum 60 caractères chacun.',
      );
      return;
    }


    if (this.password.length < 6) {
      await this.showAlert(
        'Mot de passe trop court',
        'Le mot de passe doit contenir au moins 6 caractères.',
      );
      return;
    }

    if (this.password !== this.confirmPassword) {
      await this.showAlert(
        'Mots de passe différents',
        'Les deux mots de passe ne correspondent pas.',
      );
      return;
    }

    this.isLoading = true;

    try {
      await this.firebaseService.register(email, this.password, {
        nom,
        prenom,
        age,
      });

      await this.showAlert('Compte créé', 'Ton compte a été créé avec succès.');
      await this.router.navigateByUrl('/home', { replaceUrl: true });

      this.nom = '';
      this.prenom = '';
      this.age = '';
      this.email = '';
      this.password = '';
      this.confirmPassword = '';


    } catch (error: unknown) {
      console.error('Erreur lors de la création du compte :', error);

      const code = (error as { code?: string }).code;
      const message =
        code === 'auth/email-already-in-use'
          ? 'Cette adresse e-mail est déjà utilisée.'
          : 'Le compte n’a pas pu être créé. Vérifie ta connexion et réessaie.';

      await this.showAlert('Inscription impossible', message);
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
