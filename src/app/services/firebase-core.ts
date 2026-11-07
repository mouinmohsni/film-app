import { getApp, getApps, initializeApp } from 'firebase/app';
import type { FirebaseApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import type { Auth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import type { Firestore } from 'firebase/firestore';

import { environment } from '../../environments/environment';

// cree une seule instante de la base pour l'appliction
// Réutilise l’application si elle a déjà été initialisée.
export const firebaseApp: FirebaseApp =
  getApps().length > 0 ? getApp() : initializeApp(environment.firebase);

export const firebaseAuth: Auth = getAuth(firebaseApp);
export const firestoreDb: Firestore = getFirestore(firebaseApp);
