/**
 * Administrateurs pouvant être destinataires d'un message privé (M, Z, Lucie).
 * Fichier séparé (pas 'use server') car les fichiers d'actions serveur ne
 * peuvent exporter que des fonctions async — une simple constante exportée
 * depuis un fichier 'use server' arrive invalide côté client (d'où l'erreur
 * "map is not a function" observée : la liste était vide/indéfinie).
 */
export const ADMIN_RECIPIENT_CODES = ['M', 'Z', 'L'] as const;
export type AdminRecipientCode = (typeof ADMIN_RECIPIENT_CODES)[number];
