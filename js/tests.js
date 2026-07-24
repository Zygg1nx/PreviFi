// ============================================================
// TESTS.JS — Tests de non-régression du moteur financier.
// Exécution manuelle : ouvrir la console et lancer runTests()
// Objectif : garantir qu'une modification du moteur ne casse
// pas silencieusement un calcul comptable critique.
// ============================================================
import { MathUtils } from './mathUtils.js';
import { Emprunt, Investissement } from './models.js';

function assert(condition, message) {
    console[condition ? 'log' : 'error'](`${condition ? '✅' : '❌'} ${message}`);
}

export function runTests() {
    console.group('Tests moteur financier');

    // Test 1 : arrondi cohérent
    assert(MathUtils.round2(19.9999) === 20, 'round2 arrondit correctement 19.9999 → 20');
    assert(MathUtils.safeDivide(100, 0) === 0, 'safeDivide(100,0) retourne 0 sans lever d\'exception');

    // Test 2 : emprunt — le capital restant dû doit être exactement 0 à la fin
    const emprunt = new Emprunt({ capital: 60000, tauxAnnuel: 3, dureeMois: 60, differeMois: 0 });
    const tableau = emprunt.genererTableauAmortissement();
    const dernierCRD = tableau[tableau.length - 1].crd;
    assert(dernierCRD === 0, `Emprunt soldé exactement à 0 en fin de tableau (obtenu: ${dernierCRD})`);

    const sommeCapitalRembourse = MathUtils.sum(tableau.map(l => l.capitalRembourse));
    assert(sommeCapitalRembourse === 60000, `Somme du capital remboursé = capital emprunté (obtenu: ${sommeCapitalRembourse})`);

    // Test 3 : investissement — la somme des dotations = montant HT (mode linéaire)
    const invest = new Investissement({ montantHT: 12000, dureeAns: 3, mode: 'lineaire' });
    const { dotationMensuelle } = invest.genererPlanAmortissementMensuel(60, 6); // acquisition au mois 6
    const sommeDotations = MathUtils.sum(dotationMensuelle);
    assert(sommeDotations === 12000, `Somme des dotations = montant HT investi (obtenu: ${sommeDotations})`);

    // Test 4 : prorata temporis — un investissement acquis en cours d'année a moins de dotation la 1ère année
    const dotationAnnee1 = MathUtils.sum(dotationMensuelle.slice(6, 12)); // mois 6 à 11 = 6 mois sur 12
    const dotationPleineAnnee = MathUtils.sum(dotationMensuelle.slice(18, 30)); // année complète plus tard
    assert(dotationAnnee1 < dotationPleineAnnee, `Prorata temporis appliqué (année 1 tronquée: ${dotationAnnee1} < année pleine: ${dotationPleineAnnee})`);

    // Test 5 : formule personnalisée mathjs
    const resultatFormule = MathUtils.evaluerFormule('ca * 0.08 + 50', { ca: 10000 });
    assert(resultatFormule === 850, `Formule personnalisée évaluée correctement (obtenu: ${resultatFormule})`);
    assert(MathUtils.evaluerFormule('ca *** invalide', { ca: 100 }) === 0, 'Formule invalide retourne 0 sans crasher');

    console.groupEnd();
}