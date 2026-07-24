// ============================================================
// MODELS.JS — Entités métier (Domain Model)
// Toutes les classes sont sérialisables (toJSON/fromJSON)
// ============================================================

import { MathUtils } from './mathUtils.js';
export const uid = () => (crypto.randomUUID ? crypto.randomUUID() : `id_${Date.now()}_${Math.random().toString(16).slice(2)}`);

/* ---------------------- HYPOTHÈSES ÉCONOMIQUES ---------------------- */
export class HypothesesEconomiques {
  constructor({ inflation = 2, indexation = 2, croissance = 10 } = {}) {
    this.inflation = inflation;     // % annuel
    this.indexation = indexation;   // % annuel (loyers, charges fixes)
    this.croissance = croissance;   // % annuel (objectif CA)
  }
  static fromJSON(o) { return new HypothesesEconomiques(o); }
}

/* ---------------------- ENTREPRISE ---------------------- */
export class Entreprise {
  constructor({
    nom = 'Ma Société', formeJuridique = 'SAS', tva = true,
    dateCreation = new Date().toISOString().slice(0, 10),
    dateDebutActivite = new Date().toISOString().slice(0, 10),
    devise = 'EUR', nbAnnees = 3,
    tauxIS = 15, tauxCFE = 1.5, tauxChargesSociales = 45,
    hypotheses = new HypothesesEconomiques()
  } = {}) {
    Object.assign(this, { nom, formeJuridique, tva, dateCreation, dateDebutActivite, devise, nbAnnees, tauxIS, tauxCFE, tauxChargesSociales });
    this.hypotheses = hypotheses instanceof HypothesesEconomiques ? hypotheses : HypothesesEconomiques.fromJSON(hypotheses);
  }
  static fromJSON(o) { return new Entreprise({ ...o, hypotheses: HypothesesEconomiques.fromJSON(o.hypotheses || {}) }); }
}

/* ---------------------- PRODUIT / SERVICE ---------------------- */
export class Produit {
  constructor({
    id = uid(), nom = 'Nouveau produit', famille = 'Général',
    prixHT = 0, tauxTVA = 20, modeVente = 'mensuel', // mensuel | ponctuel | abonnement | saisonnier
    modeSaisieQuantite = 'croissance', // 'croissance' | 'carnetCommande'
    quantiteMensuelle = 0, tauxCroissance = 0, remiseMoyenne = 0,
    saisonnalite = Array(12).fill(1), moisDemarrage = 0,
    // Carnet de commande : un élément par mois du projet (index 0 = 1er mois d'activité).
    // Reste vide ([]) par défaut pour ne pas alourdir les projets qui utilisent le mode croissance.
    carnetCommande = []
  } = {}) {
    Object.assign(this, {
      id, nom, famille, prixHT, tauxTVA, modeVente, modeSaisieQuantite,
      quantiteMensuelle, tauxCroissance, remiseMoyenne, saisonnalite, moisDemarrage,
      carnetCommande: [...carnetCommande]
    });
  }

  /**
   * Garantit que le carnet de commande couvre bien toute la durée du projet.
   * Complète avec des zéros si trop court (ex: l'utilisateur vient d'allonger
   * le prévisionnel de 3 à 5 ans). Ne tronque JAMAIS les données existantes
   * si le tableau est plus long que nécessaire (sécurité non-destructive :
   * si l'utilisateur raccourcit puis rallonge la durée, ses données réapparaissent).
   */
  assurerTailleCarnet(nbMoisProjet) {
    if (this.carnetCommande.length < nbMoisProjet) {
      const manquants = nbMoisProjet - this.carnetCommande.length;
      this.carnetCommande = [...this.carnetCommande, ...Array(manquants).fill(0)];
    }
  }

  /** Quantité vendue pour un index de mois global (0-based depuis début activité) */
  quantitePourMois(moisIndex) {
    if (this.modeSaisieQuantite === 'carnetCommande') {
      // Lecture directe du carnet : source de vérité unique en mode manuel.
      // Un mois non saisi (au-delà du carnet rempli) vaut 0, jamais une extrapolation implicite.
      return this.carnetCommande[moisIndex] ?? 0;
    }

    // Mode "croissance automatique" (comportement historique)
    if (moisIndex < this.moisDemarrage) return 0;
    const anneesEcoulees = Math.floor((moisIndex - this.moisDemarrage) / 12);
    const base = MathUtils.compoundGrowth(this.quantiteMensuelle, this.tauxCroissance, anneesEcoulees);
    const coeffSaison = this.modeVente === 'saisonnier' ? (this.saisonnalite[moisIndex % 12] ?? 1) : 1;
    return base * coeffSaison;
  }

  /** CA HT pour un mois donné — fonctionne identiquement quel que soit le mode de saisie */
  caMensuelHT(moisIndex) {
    const qte = this.quantitePourMois(moisIndex);
    const montant = math.evaluate('qte * prix * (1 - remise / 100)', {
      qte, prix: this.prixHT, remise: this.remiseMoyenne
    });
    return MathUtils.round2(montant);
  }

  static fromJSON(o) { return new Produit(o); }
}

/* ---------------------- SOUS-TRAITANCE ---------------------- */
export class SousTraitance {
  constructor({ id = uid(), fournisseur = '', montantMensuel = 0, tauxTVA = 20, indexation = 0, moisDemarrage = 0 } = {}) {
    Object.assign(this, { id, fournisseur, montantMensuel, tauxTVA, indexation, moisDemarrage });
  }
  montantPourMois(moisIndex) {
    if (moisIndex < this.moisDemarrage) return 0;
    const annees = Math.floor((moisIndex - this.moisDemarrage) / 12);
    return MathUtils.round2(MathUtils.compoundGrowth(this.montantMensuel, this.indexation, annees));
  }
  static fromJSON(o) { return new SousTraitance(o); }
}

/* ---------------------- CHARGES FIXES ---------------------- */
export class ChargeFixe {
  constructor({ id = uid(), categorie = 'Autres', nom = '', montantMensuel = 0, indexation = 0, moisDemarrage = 0, moisFin = null, tauxTVA = 20 } = {}) {
    Object.assign(this, { id, categorie, nom, montantMensuel, indexation, moisDemarrage, moisFin, tauxTVA });
  }
  montantPourMois(moisIndex) {
    if (moisIndex < this.moisDemarrage) return 0;
    if (this.moisFin !== null && moisIndex > this.moisFin) return 0;
    const annees = Math.floor((moisIndex - this.moisDemarrage) / 12);
    return MathUtils.round2(MathUtils.compoundGrowth(this.montantMensuel, this.indexation, annees));
  }
  static fromJSON(o) { return new ChargeFixe(o); }
}
export const CATEGORIES_CHARGES_FIXES = ['Loyer', 'Internet', 'Téléphone', 'Logiciels', 'Assurances', 'Honoraires', 'Banque', 'Marketing', 'Déplacements', 'Locations', 'Abonnements', 'Autres'];

/* ---------------------- CHARGES VARIABLES ---------------------- */
export class ChargeVariable {
  // typeCalcul: 'montant' | 'pourcentageCA' | 'pourcentageProduit' | 'formule'
  constructor({ id = uid(), nom = '', typeCalcul = 'pourcentageCA', valeur = 0, produitId = null, tauxTVA = 20, formule = '' } = {}) {
    Object.assign(this, { id, nom, typeCalcul, valeur, produitId, tauxTVA, formule });
  }

  montantPourMois(moisIndex, contexte) {
    switch (this.typeCalcul) {
      case 'montant':
        return MathUtils.round2(this.valeur);
      case 'pourcentageCA':
        return MathUtils.round2(contexte.caTotalMois * MathUtils.safeDivide(this.valeur, 100));
      case 'pourcentageProduit':
        return MathUtils.round2((contexte.caParProduit.get(this.produitId) || 0) * MathUtils.safeDivide(this.valeur, 100));
      case 'formule':
        // Mode expert : l'utilisateur saisit ex. "ca * 0.08 + 120" ou "ca / 100 * 5.5"
        return MathUtils.evaluerFormule(this.formule, { ca: contexte.caTotalMois, mois: moisIndex });
      default:
        return 0;
    }
  }
  static fromJSON(o) { return new ChargeVariable(o); }
}

/* ---------------------- PERSONNEL ---------------------- */
export class Salarie {
  constructor({
    id = uid(), nom = '', fonction = '', dateArrivee = null, dateDepart = null,
    tempsTravail = 1, salaireBrutMensuel = 0, tauxChargesPatronales = 42,
    primeAnnuelle = 0, variableMensuel = 0, participation = 0,
    mutuelleMensuelle = 0, ticketsRestaurantMensuel = 0, avantagesMensuel = 0
  } = {}) {
    Object.assign(this, { id, nom, fonction, dateArrivee, dateDepart, tempsTravail, salaireBrutMensuel, tauxChargesPatronales, primeAnnuelle, variableMensuel, participation, mutuelleMensuelle, ticketsRestaurantMensuel, avantagesMensuel });
  }

  estPresent(dateISOMois) {
    const d = new Date(dateISOMois);
    if (this.dateArrivee && d < new Date(this.dateArrivee)) return false;
    if (this.dateDepart && d > new Date(this.dateDepart)) return false;
    return true;
  }

  coutMensuel(dateISOMois, moisEstDecembre = false) {
    if (!this.estPresent(dateISOMois)) return { brut: 0, charges: 0, annexes: 0, total: 0 };
    const brutBase = MathUtils.round2(this.salaireBrutMensuel * this.tempsTravail + this.variableMensuel);
    const prime = moisEstDecembre ? this.primeAnnuelle : 0;
    const brut = MathUtils.round2(brutBase + prime);
    const charges = MathUtils.round2(brut * MathUtils.safeDivide(this.tauxChargesPatronales, 100));
    const annexes = MathUtils.round2(
      this.mutuelleMensuelle + this.ticketsRestaurantMensuel + this.avantagesMensuel + MathUtils.safeDivide(this.participation, 12)
    );
    return { brut, charges, annexes, total: MathUtils.round2(brut + charges + annexes) };
  }
  static fromJSON(o) { return new Salarie(o); }
}

/* ---------------------- INVESTISSEMENTS ---------------------- */
export class Investissement {
  constructor({ id = uid(), nom = '', categorie = 'corporel', montantHT = 0, tauxTVA = 20, dateAcquisition = new Date().toISOString().slice(0, 10), dureeAns = 5, mode = 'lineaire' } = {}) {
    Object.assign(this, { id, nom, categorie, montantHT, tauxTVA, dateAcquisition, dureeAns, mode });
  }

  static coeffDegressif(duree) {
    if (duree <= 4) return 1.25;
    if (duree <= 6) return 1.75;
    return 2.25;
  }

  /**
   * Génère la dotation mensuelle sur toute la durée du projet, avec un
   * vrai prorata temporis : la première dotation tombe exactement au
   * mois d'acquisition, pas au 1er janvier de l'année du projet.
   * @param {number} nbMoisProjet - horizon total du prévisionnel (en mois)
   * @param {number} moisAcquisitionIndex - mois d'acquisition (0-based depuis le début d'activité)
   * @returns {{dotationMensuelle:number[], vncMensuelle:number[]}}
   */
  genererPlanAmortissementMensuel(nbMoisProjet, moisAcquisitionIndex) {
    const dotationMensuelle = Array(nbMoisProjet).fill(0);
    const vncMensuelle = Array(nbMoisProjet).fill(this.montantHT);
    if (moisAcquisitionIndex >= nbMoisProjet || moisAcquisitionIndex < 0) {
      return { dotationMensuelle, vncMensuelle: Array(nbMoisProjet).fill(0) };
    }

    const dureeMois = this.dureeAns * 12;
    let vnc = this.montantHT;

    if (this.mode === 'lineaire') {
      const dotationFixe = MathUtils.round2(MathUtils.safeDivide(this.montantHT, dureeMois));
      for (let m = 0; m < dureeMois; m++) {
        const idx = moisAcquisitionIndex + m;
        if (idx >= nbMoisProjet) break;
        vnc = Math.max(0, MathUtils.round2(vnc - dotationFixe));
        dotationMensuelle[idx] = dotationFixe;
        vncMensuelle[idx] = vnc;
      }
    } else {
      // Dégressif mensualisé avec bascule automatique au linéaire quand celui-ci devient plus favorable
      const coeff = Investissement.coeffDegressif(this.dureeAns);
      let moisRestants = dureeMois;
      for (let m = 0; m < dureeMois; m++) {
        const idx = moisAcquisitionIndex + m;
        if (idx >= nbMoisProjet) break;
        const tauxDegressifMensuel = MathUtils.safeDivide(coeff, moisRestants);
        const dotDeg = MathUtils.round2(vnc * tauxDegressifMensuel);
        const dotLin = MathUtils.round2(MathUtils.safeDivide(vnc, moisRestants));
        const dotation = Math.max(dotDeg, dotLin);
        vnc = Math.max(0, MathUtils.round2(vnc - dotation));
        dotationMensuelle[idx] = dotation;
        vncMensuelle[idx] = vnc;
        moisRestants--;
      }
    }
    // Avant l'acquisition, la VNC affichée = valeur brute (l'actif n'existe pas encore comptablement, géré en amont par le moteur)
    for (let i = 0; i < moisAcquisitionIndex; i++) vncMensuelle[i] = 0;

    return { dotationMensuelle, vncMensuelle };
  }

  static fromJSON(o) { return new Investissement(o); }
}
/* ---------------------- EMPRUNTS ---------------------- */
export class Emprunt {
  constructor({ id = uid(), nom = '', capital = 0, tauxAnnuel = 3, dureeMois = 60, differeMois = 0, dateDebut = new Date().toISOString().slice(0, 10) } = {}) {
    Object.assign(this, { id, nom, capital, tauxAnnuel, dureeMois, differeMois, dateDebut });
  }

  genererTableauAmortissement() {
    const tauxMensuel = MathUtils.safeDivide(this.tauxAnnuel, 1200); // taux annuel % → taux mensuel décimal
    const table = [];
    let crd = this.capital;

    for (let m = 1; m <= this.differeMois; m++) {
      const interets = MathUtils.round2(crd * tauxMensuel);
      table.push({ mois: m, interets, capitalRembourse: 0, mensualite: interets, crd: MathUtils.round2(crd) });
    }

    const nbMoisAmort = this.dureeMois - this.differeMois;
    const mensualite = MathUtils.round2(MathUtils.pmt(crd, tauxMensuel, nbMoisAmort));

    for (let m = 1; m <= nbMoisAmort; m++) {
      const interets = MathUtils.round2(crd * tauxMensuel);
      let capitalRembourse = MathUtils.round2(mensualite - interets);
      // Dernière échéance : on solde exactement le CRD pour éviter les résidus d'arrondi cumulés
      if (m === nbMoisAmort) capitalRembourse = MathUtils.round2(crd);
      crd = Math.max(0, MathUtils.round2(crd - capitalRembourse));
      table.push({
        mois: this.differeMois + m,
        interets,
        capitalRembourse,
        mensualite: MathUtils.round2(interets + capitalRembourse),
        crd
      });
    }
    return table;
  }
  static fromJSON(o) { return new Emprunt(o); }
}

/* ---------------------- APPORTS ---------------------- */
export class Apport {
  // type: capital | ccaAssocie | subvention | loveMoney | leveeFonds | crowdfunding
  constructor({ id = uid(), type = 'capital', libelle = '', montant = 0, moisIndex = 0 } = {}) {
    Object.assign(this, { id, type, libelle, montant, moisIndex });
  }
  static fromJSON(o) { return new Apport(o); }
}

/* ---------------------- PARAMÈTRES BFR ---------------------- */
export class ParametresBFR {
  constructor({ delaiClientJours = 30, delaiFournisseurJours = 30, delaiStockJours = 0, tauxStockSurCA = 0 } = {}) {
    Object.assign(this, { delaiClientJours, delaiFournisseurJours, delaiStockJours, tauxStockSurCA });
  }
  static fromJSON(o) { return new ParametresBFR(o); }
}

/* ---------------------- SCÉNARIOS ---------------------- */
export class Scenario {
  constructor({ id = uid(), nom = 'normal', coefficients = {} } = {}) {
    this.id = id; this.nom = nom;
    this.coefficients = {
      ca: 1, charges: 1, salaires: 1, investissements: 1,
      delaisPaiement: 1, croissance: 1, inflation: 1,
      ...coefficients
    };
  }
  static defaults() {
    return {
      normal: new Scenario({ nom: 'normal', coefficients: {} }),
      optimiste: new Scenario({ nom: 'optimiste', coefficients: { ca: 1.20, charges: 0.95, croissance: 1.3 } }),
      pessimiste: new Scenario({ nom: 'pessimiste', coefficients: { ca: 0.80, charges: 1.10, croissance: 0.6, delaisPaiement: 1.3 } })
    };
  }
  static fromJSON(o) { return new Scenario(o); }
}

/* ---------------------- PROJET (Aggregate root) ---------------------- */
export class Projet {
  constructor(data = {}) {
    this.id = data.id || uid();
    this.meta = data.meta || { createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), version: '1.0.0' };
    this.entreprise = data.entreprise instanceof Entreprise ? data.entreprise : Entreprise.fromJSON(data.entreprise || {});
    this.produits = (data.produits || []).map(p => p instanceof Produit ? p : Produit.fromJSON(p));
    this.sousTraitance = (data.sousTraitance || []).map(s => s instanceof SousTraitance ? s : SousTraitance.fromJSON(s));
    this.chargesVariables = (data.chargesVariables || []).map(c => c instanceof ChargeVariable ? c : ChargeVariable.fromJSON(c));
    this.chargesFixes = (data.chargesFixes || []).map(c => c instanceof ChargeFixe ? c : ChargeFixe.fromJSON(c));
    this.personnel = (data.personnel || []).map(s => s instanceof Salarie ? s : Salarie.fromJSON(s));
    this.investissements = (data.investissements || []).map(i => i instanceof Investissement ? i : Investissement.fromJSON(i));
    this.emprunts = (data.emprunts || []).map(e => e instanceof Emprunt ? e : Emprunt.fromJSON(e));
    this.apports = (data.apports || []).map(a => a instanceof Apport ? a : Apport.fromJSON(a));
    this.bfr = data.bfr instanceof ParametresBFR ? data.bfr : ParametresBFR.fromJSON(data.bfr || {});
    const defScenarios = Scenario.defaults();
    this.scenarios = data.scenarios
      ? _.mapValues(data.scenarios, s => Scenario.fromJSON(s))
      : defScenarios;
    this.scenarioActif = data.scenarioActif || 'normal';
    this.tresorerieInitiale = data.tresorerieInitiale || 0;
  }

  toJSON() {
    this.meta.updatedAt = new Date().toISOString();
    return {
      id: this.id,
      meta: { ...this.meta },
      entreprise: this.entreprise,
      produits: this.produits,
      sousTraitance: this.sousTraitance,
      chargesVariables: this.chargesVariables,
      chargesFixes: this.chargesFixes,
      personnel: this.personnel,
      investissements: this.investissements,
      emprunts: this.emprunts,
      apports: this.apports,
      bfr: this.bfr,
      scenarios: this.scenarios,
      scenarioActif: this.scenarioActif,
      tresorerieInitiale: this.tresorerieInitiale
    };
  }

  static fromJSON(o) { return new Projet(o); }
}