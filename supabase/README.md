# Supabase : compte, synchronisation et assistant styliste

1. Crée un projet Supabase et active l’authentification par e-mail et mot de passe.
2. Copie l’URL du projet et la clé `anon` dans le fichier `.env` local, avec les noms de `.env.example`.
3. Exécute `migrations/202610210001_cloud_backup_bucket.sql` dans l’éditeur SQL du projet. La sauvegarde est privée et chaque compte ne peut lire que son propre dossier.
4. Pour Gemini, ajoute la clé côté serveur avec `supabase secrets set GEMINI_API_KEY`, puis déploie `supabase functions deploy stylist` depuis la racine du dépôt. Ne mets jamais cette clé dans `.env` ni dans l’app.
5. Pour le détourage, ajoute la clé du fournisseur avec `supabase secrets set REMOVE_BG_API_KEY=ta-cle-api`, puis déploie `supabase functions deploy remove-background`. La clé reste côté serveur.
6. Pour l’import d’une photo de tenue et les photos « boutique », déploie `supabase functions deploy analyze-outfit` et `supabase functions deploy product-shot`. Elles utilisent la même clé `GEMINI_API_KEY`. Les modèles se changent sans redéployer l’app avec `supabase secrets set GEMINI_VISION_MODEL=…` (repérage des pièces, par défaut `gemini-3.5-flash-lite`) et `GEMINI_IMAGE_MODEL=…` (création des photos, par défaut `gemini-3.1-flash-lite-image`).
7. Redémarre l’app après avoir ajouté les variables d’environnement.

Dans Profil > Synchronisation en ligne, crée un compte puis utilise les boutons de sauvegarde et de restauration sur tes appareils. Chaque sauvegarde remplace la précédente pour ce compte. Elle contient les photos en base64, le dressing, les favoris, l’historique et les préférences.

L’assistant envoie à la fonction `stylist` la question, une liste texte des vêtements et, si disponible, un résumé de la météo. Il ne transmet pas les photos. La fonction exige une session Supabase et appelle Gemini 3.5 Flash-Lite avec une limite de réponse.

Le bouton « Retirer le fond » envoie la photo choisie à la fonction `remove-background` uniquement après confirmation par appui. Cette fonction exige une session Supabase et renvoie un PNG transparent. Le fournisseur remove.bg annonce une migration vers Leonardo.Ai à partir du 1er décembre 2026 : avant cette date, remplacez l’URL et l’adaptateur du fournisseur dans `functions/remove-background/index.ts` si son API change.

Le bouton « Tenue » du Dressing envoie la photo choisie à `analyze-outfit`, qui renvoie chaque pièce repérée (type, couleurs, occasions, position). Pour chaque pièce, `product-shot` demande à Gemini une photo produit sur fond clair, comme sur un site de vente. À l’ajout d’un seul vêtement, la photo boutique est créée automatiquement ; « Garder ma photo » permet de revenir à la photo d’origine. Ces deux fonctions exigent une session Supabase. La création d’images (photos boutique) n’est pas incluse dans l’offre gratuite de Gemini : il faut activer la facturation sur Google AI Studio.
