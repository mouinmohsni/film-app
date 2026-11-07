import { Component, inject, signal } from '@angular/core';
import { AlertController } from '@ionic/angular';
import {
  AdminUser,
  FirebaseService,
} from '../../services/firebase.service';

@Component({
  selector: 'app-users',
  templateUrl: './users.page.html',
  styleUrls: ['./users.page.scss'],
  standalone: false,
})
export class UsersPage {
  private readonly firebaseService = inject(FirebaseService);
  private readonly alertController = inject(AlertController);

  users = signal<AdminUser[]>([]);
  isLoading = signal(false);
  errorMessage = signal('');
  updatingUserId = signal<string | null>(null);

  // Ionic rappelle cette méthode à chaque ouverture de la page.
  ionViewWillEnter(): void {
    void this.loadUsers();
  }

  async loadUsers(): Promise<void> {
    this.isLoading.set(true);
    this.errorMessage.set('');

    try {
      const users = await this.firebaseService.getAdminUsers();
      this.users.set(users);
    } catch (error: unknown) {
      console.error('Erreur lors du chargement des utilisateurs :', error);
      this.errorMessage.set(
        'Impossible de charger les comptes. Vérifie que tu es connecté avec un compte administrateur actif et réessaie.',
      );
    } finally {
      this.isLoading.set(false);
    }
  }

  async toggleUserStatus(user: AdminUser): Promise<void> {
    if (this.updatingUserId() !== null) {
      return;
    }

    const currentUserId = this.firebaseService.auth.currentUser?.uid;

    if (user.uid === currentUserId) {
      await this.showAlert(
        'Action impossible',
        'Tu ne peux pas désactiver le compte administrateur avec lequel tu es connecté.',
      );
      return;
    }

    if (user.role === 'admin') {
      await this.showAlert(
        'Action protégée',
        'Cette action est réservée aux comptes utilisateur. La page ne permet pas de désactiver un autre compte administrateur.',
      );
      return;
    }

    const nextStatus = !user.isActive;
    const action = nextStatus ? 'activer' : 'désactiver';

    const confirmation = await this.alertController.create({
      header: `Confirmer l’action`,
      message: `Veux-tu vraiment ${action} le compte de ${user.prenom} ${user.nom} (${user.email}) ?`,
      buttons: [
        {
          text: 'Annuler',
          role: 'cancel',
        },
        {
          text: nextStatus ? 'Activer' : 'Désactiver',
          role: 'confirm',
        },
      ],
    });

    await confirmation.present();

    const { role } = await confirmation.onDidDismiss();

    if (role !== 'confirm') {
      return;
    }

    this.updatingUserId.set(user.uid);
    this.errorMessage.set('');

    try {
      await this.firebaseService.setUserActive(user.uid, nextStatus);

      this.users.update((currentUsers) =>
        currentUsers.map((currentUser) =>
          currentUser.uid === user.uid
            ? { ...currentUser, isActive: nextStatus }
            : currentUser,
        ),
      );

      await this.showAlert(
        'Modification enregistrée',
        `Le compte de ${user.prenom} ${user.nom} a été ${nextStatus ? 'activé' : 'désactivé'}.`,
      );
    } catch (error: unknown) {
      console.error('Erreur lors du changement de statut :', error);

      await this.showAlert(
        'Modification impossible',
        'Le statut du compte n’a pas pu être modifié. Vérifie les règles Firestore et réessaie.',
      );
    } finally {
      this.updatingUserId.set(null);
    }
  }

  isCurrentUser(user: AdminUser): boolean {
    return user.uid === this.firebaseService.auth.currentUser?.uid;
  }

  private async showAlert(header: string, message: string): Promise<void> {
    const alert = await this.alertController.create({
      header,
      message,
      buttons: ['OK'],
    });

    await alert.present();
  }
}
