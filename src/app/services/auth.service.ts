import { Injectable } from '@angular/core';

//  importer les Fonctions de Firebase Authentication
import {
  createUserWithEmailAndPassword,
  deleteUser,
  EmailAuthProvider,
  reauthenticateWithCredential,
  signInWithEmailAndPassword,
  signOut,
  updatePassword,
} from 'firebase/auth';

import type { UserCredential } from 'firebase/auth';

// Fonctions Firestore pour créer le document de profil.
import { doc, setDoc } from 'firebase/firestore';

// Instances Firebase
import { firebaseAuth, firestoreDb } from './firebase-core';

@Injectable({

  providedIn: 'root',
})
export class AuthService {

  readonly auth = firebaseAuth;

  // Crée un compte Firebase Authentication puis son profil Firestore.
  async register(
    email: string,
    password: string,
    profile: { nom: string; prenom: string; age: number },
  ): Promise<UserCredential> {
    // Crée le compte en utilisant la fonction createUserWithEmailAndPassword .

    const credential = await createUserWithEmailAndPassword(
      this.auth,
      email,
      password,
    );

    try {
      // Crée le profil Firestore dans users/{UID}.

      await setDoc(doc(firestoreDb, 'users', credential.user.uid), {
        nom: profile.nom,
        prenom: profile.prenom,
        age: profile.age,

        //
        email: credential.user.email ?? email,

        role: 'user',
        isActive: true,
      });

      // Renvoie les informations de connexion au code appelant.
      return credential;
    } catch (error) {

      try {
        //on cas d'erreur en supprime le  compte cree
        await deleteUser(credential.user);
      } catch (cleanupError) {

        console.error(
          'La suppression du compte incomplet a échoué :',
          cleanupError,
        );
      }

      throw error;
    }
  }

  // Connecte un utilisateur existant avec son e-mail et son mot de passe.
  login(email: string, password: string): Promise<UserCredential> {
    return signInWithEmailAndPassword(this.auth, email, password);
  }

  // Ferme la session Firebase de l’utilisateur actuellement connecté.
  logout(): Promise<void> {
    return signOut(this.auth);
  }

  // Change le mot de passe a
  async changePassword(
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    // Récupère l’utilisateur actuellement connecté.
    const user = this.auth.currentUser;

    // Impossible de modifier le mot de passe sans session active.
    if (!user) {
      throw new Error('Tu dois être connecté pour changer ton mot de passe.');
    }

    if (!user.email) {
      throw new Error('Aucune adresse e-mail n’est associée à ce compte.');
    }

    // Vérifie la longueur minimale
    if (newPassword.length < 6) {
      throw new Error(
        'Le nouveau mot de passe doit contenir au moins 6 caractères.',
      );
    }

    // Prépare les identifiants à partir de l’e-mail et du mot de passe actuel.
    const credential = EmailAuthProvider.credential(
      user.email,
      currentPassword,
    );

    // Confirme l’identité de l’utilisateur avec son mot de passe actuel.
    await reauthenticateWithCredential(user, credential);

    // Après vérification, enregistre le nouveau mot de passe dans Firebase.
    await updatePassword(user, newPassword);
  }
}
