import { inject } from '@angular/core';
import {
  CanActivateFn,
  Router,
  UrlTree,
} from '@angular/router';
import { FirebaseService } from '../services/firebase.service';

export const adminGuard: CanActivateFn = async (): Promise<boolean | UrlTree> => {
  const firebaseService = inject(FirebaseService);
  const router = inject(Router);

  try {
    // Attend que Firebase ait fini de restaurer la session au démarrage.
    await firebaseService.auth.authStateReady();

    const user = firebaseService.auth.currentUser;

    if (!user) {
      return router.createUrlTree(['/login']);
    }

    const profile = await firebaseService.getProfile();

    if (profile?.role === 'admin' && profile.isActive === true) {
      return true;
    }

    return router.createUrlTree(['/home']);
  } catch (error: unknown) {
    console.error('Erreur lors de la vérification de l’accès admin :', error);
    return router.createUrlTree(['/home']);
  }
};
