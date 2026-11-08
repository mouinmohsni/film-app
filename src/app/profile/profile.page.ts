import {
  Component,
  OnDestroy,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { Camera } from '@capacitor/camera';
import { onAuthStateChanged } from 'firebase/auth';
import type { Unsubscribe } from 'firebase/auth';
import { FirebaseService } from '../services/firebase.service';
import type { UserProfile } from '../services/firebase.service';
import { ActionSheetController, AlertController } from '@ionic/angular';


@Component({
  selector: 'app-profile',
  templateUrl: './profile.page.html',
  styleUrls: ['./profile.page.scss'],
  standalone: false,
})
export class ProfilePage implements OnInit, OnDestroy {
  private readonly firebaseService = inject(FirebaseService);
  private readonly alertController = inject(AlertController);


  profile = signal<UserProfile | null>(null);
  isLoading = signal(true);
  isAuthenticated = signal(false);
  isPhotoSaving = signal(false);
  errorMessage = signal('');
  photoMessage = signal('');

  currentPassword = '';
  newPassword = '';
  confirmNewPassword = '';

  isPasswordChanging = signal(false);
  passwordMessage = signal('');
  passwordMessageType = signal<'success' | 'error'>('success');

  private readonly actionSheetController = inject(ActionSheetController);


  private stopAuthListener?: Unsubscribe;

  ngOnInit(): void {
    this.stopAuthListener = onAuthStateChanged(
      this.firebaseService.auth,
      (user) => {
        this.isAuthenticated.set(!!user);

        if (user) {
          void this.loadProfile();
        } else {
          this.profile.set(null);
          this.errorMessage.set('Connecte-toi pour consulter ton profil.');
          this.isLoading.set(false);
        }
      },
    );
  }

  ngOnDestroy(): void {
    this.stopAuthListener?.();
  }

  // Récupère le profil de l’utilisateur
  async loadProfile(): Promise<void> {
    this.isLoading.set(true);
    this.errorMessage.set('');

    try {
      const profile = await this.firebaseService.getProfile();

      if (!profile) {
        this.errorMessage.set('Aucun profil trouvé pour ce compte.');
        this.profile.set(null);
        return;
      }

      this.profile.set(profile);
    } catch (error: unknown) {
      console.error('Erreur lors du chargement du profil :', error);
      this.errorMessage.set('Impossible de charger ton profil. Réessaie.');
    } finally {
      this.isLoading.set(false);
    }
  }

  // Ouvre l’appareil photo pour prendre une nouvelle photo de profil.

  async takeProfilePhoto(): Promise<void> {
    await this.runPhotoAction(async () => {
      const result = await Camera.takePhoto({
        quality: 80,
        targetWidth: 1024,
        targetHeight: 1024,
      });

      return result.webPath ?? null;
    });
  }


  async chooseProfilePhoto(): Promise<void> {
    await this.runPhotoAction(async () => {
      const result = await Camera.chooseFromGallery({
        quality: 80,
        targetWidth: 1024,
        targetHeight: 1024,
      });


      const webPath = result.results[0]?.webPath ?? null;

      if (!webPath) {
        this.photoMessage.set('Aucune photo n’a été reçue du sélecteur.');
        return null;
      }

      return webPath;
    });
  }


  private async runPhotoAction(
    getWebPath: () => Promise<string | null>,
  ): Promise<void> {
    if (!this.isAuthenticated() || this.isPhotoSaving()) {
      return;
    }

    this.isPhotoSaving.set(true);
    this.photoMessage.set('');

    try {
      this.photoMessage.set('Ouverture du sélecteur de photo…');

      const webPath = await getWebPath();

      // L’utilisateur a peut-être annulé le choix dans la galerie.
      if (!webPath) {
        return;
      }

      this.photoMessage.set('Préparation et enregistrement de la photo…');


      const photoDataUrl = await this.createSmallJpeg(webPath);

      await this.firebaseService.saveProfilePhoto(photoDataUrl);

      this.profile.update((profile) =>
        profile ? { ...profile, photoDataUrl } : profile,
      );

      this.photoMessage.set('Photo de profil enregistrée.');
    } catch (error: unknown) {
      const detail = error instanceof Error ? error.message : String(error);

      if (/cancel|annul/i.test(detail)) {
        this.photoMessage.set('Sélection annulée.');
        return;
      }

      console.error('Erreur lors de l’enregistrement de la photo :', error);

      this.photoMessage.set(
        detail.toLowerCase().includes('permission')
          ? 'Firestore refuse l’enregistrement. Les règles photo doivent être publiées sur le projet utilisé par l’application.'
          : 'Impossible de traiter ou d’enregistrer la photo. Réessaie avec une image JPG ou PNG.',
      );
    } finally {

      this.isPhotoSaving.set(false);
    }
  }

  async changePassword(): Promise<void> {
    this.passwordMessage.set('');

    if (!this.currentPassword || !this.newPassword || !this.confirmNewPassword) {
      this.passwordMessageType.set('error');
      this.passwordMessage.set('Remplis tous les champs du mot de passe.');
      return;
    }

    if (this.newPassword.length < 6) {
      this.passwordMessageType.set('error');
      this.passwordMessage.set(
        'Le nouveau mot de passe doit contenir au moins 6 caractères.',
      );
      return;
    }

    if (this.newPassword !== this.confirmNewPassword) {
      this.passwordMessageType.set('error');
      this.passwordMessage.set('Les deux nouveaux mots de passe ne correspondent pas.');
      return;
    }

    this.isPasswordChanging.set(true);

    try {
      await this.firebaseService.changePassword(
        this.currentPassword,
        this.newPassword,
      );

      const alert = await this.alertController.create({
        header: 'Mot de passe modifié',
        message: 'Ton mot de passe a été changé avec succès.',
        buttons: ['OK'],
      });

      await alert.present();


      this.currentPassword = '';
      this.newPassword = '';
      this.confirmNewPassword = '';
      this.passwordMessageType.set('success');
      this.passwordMessage.set('Ton mot de passe a été modifié.');
    } catch (error: unknown) {
      console.error('Erreur lors du changement de mot de passe :', error);

      const code = (error as { code?: string }).code;

      this.passwordMessageType.set('error');

      if (
        code === 'auth/wrong-password' ||
        code === 'auth/invalid-credential'
      ) {
        this.passwordMessage.set('Le mot de passe actuel est incorrect.');
      } else if (code === 'auth/requires-recent-login') {
        this.passwordMessage.set(
          'Reconnecte-toi à ton compte, puis réessaie.',
        );
      } else if (code === 'auth/weak-password') {
        this.passwordMessage.set(
          'Le nouveau mot de passe doit contenir au moins 6 caractères.',
        );
      } else {
        this.passwordMessage.set(
          'Le mot de passe n’a pas pu être modifié. Réessaie.',
        );
      }
    } finally {
      this.isPasswordChanging.set(false);
    }
  }


  private createSmallJpeg(webPath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const image = new Image();

      image.onload = () => {
        const maxDimension = 256;
        const scale = Math.min(
          1,
          maxDimension / image.naturalWidth,
          maxDimension / image.naturalHeight,
        );

        const width = Math.max(1, Math.round(image.naturalWidth * scale));
        const height = Math.max(1, Math.round(image.naturalHeight * scale));
        const canvas = document.createElement('canvas');

        canvas.width = width;
        canvas.height = height;

        const context = canvas.getContext('2d');

        if (!context) {
          reject(new Error('Impossible de préparer la miniature.'));
          return;
        }

        context.fillStyle = '#ffffff';
        context.fillRect(0, 0, width, height);
        context.drawImage(image, 0, 0, width, height);

        const photoDataUrl = canvas.toDataURL('image/jpeg', 0.72);

        if (photoDataUrl.length > 600_000) {
          reject(new Error('La miniature est encore trop volumineuse.'));
          return;
        }

        resolve(photoDataUrl);
      };

      image.onerror = () => {
        reject(new Error('Impossible de lire le fichier image.'));
      };

      image.src = webPath;
    });
  }

  async openPhotoOptions(): Promise<void> {
    const actionSheet = await this.actionSheetController.create({
      header: 'Photo de profil',
      buttons: [
        {
          text: 'Prendre une photo',
          icon: 'camera-outline',
          handler: () => {
            void this.takeProfilePhoto();
          },
        },
        {
          text: 'Choisir une photo',
          icon: 'images-outline',
          handler: () => {
            void this.chooseProfilePhoto();
          },
        },
        {
          text: 'Annuler',
          role: 'cancel',
        },
      ],
    });

    await actionSheet.present();
  }

}
