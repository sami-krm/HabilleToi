import { requireOptionalNativeModule } from 'expo';

// Absent dans Expo Go et sur Android : l'app garde alors son découpage habituel
const SubjectLift = requireOptionalNativeModule<{ liftSubject(uri: string): Promise<string> }>('SubjectLift');

export const isSubjectLiftAvailable = () => SubjectLift !== null;

/** Détoure le sujet de la photo sur l'iPhone (gratuit, sans envoi) ; renvoie l'adresse d'un PNG transparent. */
export function liftSubject(uri: string): Promise<string> {
  if (!SubjectLift) return Promise.reject(new Error('Détourage indisponible sur cet appareil.'));
  return SubjectLift.liftSubject(uri);
}
