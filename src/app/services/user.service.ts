import { Injectable } from '@angular/core';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  updateDoc,
} from 'firebase/firestore';

import { firebaseAuth, firestoreDb } from './firebase-core';

export interface UserProfile {
  nom: string;
  prenom: string;
  age: number;
  email: string;
  role: string;
  isActive: boolean;
  photoDataUrl?: string;
  matchingEnabled?: boolean;
}

export interface AdminUser {
  uid: string;
  nom: string;
  prenom: string;
  age: number;
  email: string;
  role: string;
  isActive: boolean;
}

@Injectable({
  providedIn: 'root',
})
export class UserService {
  private getCurrentUserId(): string {
    const userId = firebaseAuth.currentUser?.uid;

    if (!userId) {
      throw new Error('Tu dois être connecté pour accéder à ces données.');
    }

    return userId;
  }

  async getProfile(): Promise<UserProfile | null> {
    const userId = this.getCurrentUserId();
    const profileRef = doc(firestoreDb, 'users', userId);
    const profileSnapshot = await getDoc(profileRef);

    if (!profileSnapshot.exists()) {
      return null;
    }

    return profileSnapshot.data() as UserProfile;
  }

  async getMatchingEnabled(): Promise<boolean> {
    const profile = await this.getProfile();
    return profile?.matchingEnabled === true;
  }

  async saveProfilePhoto(photoDataUrl: string): Promise<void> {
    if (!photoDataUrl.startsWith('data:image/jpeg;base64,')) {
      throw new Error('La photo doit être au format JPEG.');
    }

    if (photoDataUrl.length > 600_000) {
      throw new Error(
        'La photo est trop volumineuse. Choisis une image plus petite.',
      );
    }

    const userId = this.getCurrentUserId();
    const profileRef = doc(firestoreDb, 'users', userId);

    await updateDoc(profileRef, { photoDataUrl });
  }

  async getAdminUsers(): Promise<AdminUser[]> {
    const currentUserId = this.getCurrentUserId();
    const currentProfile = await this.getProfile();

    if (
      currentProfile?.role !== 'admin' ||
      currentProfile.isActive !== true
    ) {
      throw new Error('ADMIN_REQUIRED');
    }

    const usersSnapshot = await getDocs(collection(firestoreDb, 'users'));

    return usersSnapshot.docs
      .map((userDoc) => {
        const data = userDoc.data() as UserProfile;

        return {
          uid: userDoc.id,
          nom: data.nom ?? '',
          prenom: data.prenom ?? '',
          age: data.age ?? 0,
          email: data.email ?? '',
          role: data.role ?? 'user',
          isActive: data.isActive === true,
        };
      })
      .sort((a, b) => {
        if (a.uid === currentUserId) return -1;
        if (b.uid === currentUserId) return 1;

        return a.nom.localeCompare(b.nom, 'fr');
      });
  }

  async setUserActive(userId: string, isActive: boolean): Promise<void> {
    const currentUserId = this.getCurrentUserId();
    const currentProfile = await this.getProfile();

    if (
      currentProfile?.role !== 'admin' ||
      currentProfile.isActive !== true
    ) {
      throw new Error('ADMIN_REQUIRED');
    }

    if (typeof isActive !== 'boolean') {
      throw new Error('INVALID_ACTIVE_STATUS');
    }

    if (userId === currentUserId && !isActive) {
      throw new Error('ADMIN_CANNOT_DISABLE_SELF');
    }

    const userRef = doc(firestoreDb, 'users', userId);
    const userSnapshot = await getDoc(userRef);

    if (!userSnapshot.exists()) {
      throw new Error('USER_NOT_FOUND');
    }

    await updateDoc(userRef, { isActive });
  }
}
