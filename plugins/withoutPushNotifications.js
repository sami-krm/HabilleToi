// L'app n'envoie que des notifications locales (rappel du matin) : on retire l'autorisation push
// qu'ajoute expo-notifications, refusée par les comptes Apple gratuits.
const { withEntitlementsPlist } = require('expo/config-plugins');

module.exports = (config) =>
  withEntitlementsPlist(config, (mod) => {
    delete mod.modResults['aps-environment'];
    return mod;
  });
