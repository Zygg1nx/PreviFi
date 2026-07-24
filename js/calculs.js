// ============================================================
// CALCULS.JS — Moteur financier & comptable indépendant de l'UI
// Respecte les normes comptables françaises (PCG simplifié).
// Toute la donnée dérivée (CA, charges, personnel, amortissements,
// emprunts, fiscalité, BFR, trésorerie, CR/SIG, bilan, plan de
// financement, ratios) est calculée ICI, jamais dans l'UI.
// ============================================================

import { MathUtils } from './mathUtils.js';

export class FinancialEngine {
    constructor(projet) {
        this.projet = projet;
        this.nbMois = projet.entreprise.nbAnnees * 12;
        this.scenario = projet.scenarios[projet.scenarioActif] || projet.scenarios.normal;
        this.resultats = null;
    }

    /** Point d'entrée unique : calcule tout et renvoie un objet immuable */
    recalculerTout() {
        const periodes = this._genererPeriodes();
        const ca = this._calculerCA(periodes);
        const achats = this._calculerAchatsEtChargesVariables(periodes, ca);
        const chargesFixes = this._calculerChargesFixes(periodes);
        const personnel = this._calculerPersonnel(periodes);
        const investAmort = this._calculerInvestissements(periodes);
        const empruntsCalc = this._calculerEmprunts();
        const fiscalite = this._calculerFiscalite(periodes, ca, achats, chargesFixes, personnel, empruntsCalc);
        const bfr = this._calculerBFR(periodes, ca, achats);
        const compteResultat = this._calculerCompteResultat(periodes, ca, achats, chargesFixes, personnel, investAmort, empruntsCalc, fiscalite);
        const tresorerie = this._calculerTresorerie(periodes, ca, achats, chargesFixes, personnel, investAmort, empruntsCalc, fiscalite, compteResultat);
        const bilan = this._calculerBilan(periodes, investAmort, empruntsCalc, tresorerie, bfr, compteResultat);
        const planFinancement = this._calculerPlanFinancement(periodes, investAmort, empruntsCalc, compteResultat, bfr);
        const ratios = this._calculerRatios(periodes, compteResultat, bilan, bfr, empruntsCalc, chargesFixes, achats);

        this.resultats = Object.freeze({
            periodes, ca, achats, chargesFixes, personnel, investAmort, empruntsCalc,
            fiscalite, bfr, compteResultat, tresorerie, bilan, planFinancement, ratios
        });
        return this.resultats;
    }

    // ---------------------------------------------------------
    // 0. CALENDRIER
    // ---------------------------------------------------------
    _genererPeriodes() {
        const dateDebut = new Date(this.projet.entreprise.dateDebutActivite);
        const periodes = [];
        for (let i = 0; i < this.nbMois; i++) {
            const d = new Date(dateDebut);
            d.setMonth(d.getMonth() + i);
            periodes.push({
                index: i,
                annee: Math.floor(i / 12) + 1,        // année N1, N2, ...
                moisDansAnnee: (i % 12) + 1,
                dateISO: d.toISOString().slice(0, 10),
                estDecembre: d.getMonth() === 11
            });
        }
        return periodes;
    }

    // ---------------------------------------------------------
    // 1. CHIFFRE D'AFFAIRES
    // ---------------------------------------------------------
    _calculerCA(periodes) {
        const coeff = this.scenario.coefficients.ca;
        const detailParProduit = {};
        const totalMensuel = Array(this.nbMois).fill(0);
        const parFamille = {};

        for (const produit of this.projet.produits) {
            produit.assurerTailleCarnet(this.nbMois);   // ← LIGNE À AJOUTER (garde-fou de taille)
            const serie = periodes.map(p => produit.caMensuelHT(p.index) * coeff);
            detailParProduit[produit.id] = serie;
            serie.forEach((v, i) => totalMensuel[i] += v);
            parFamille[produit.famille] = parFamille[produit.famille] || Array(this.nbMois).fill(0);
            serie.forEach((v, i) => parFamille[produit.famille][i] += v);
        }

        const totalAnnuel = this._agregerParAnnee(totalMensuel, periodes);
        return { detailParProduit, totalMensuel, totalAnnuel, parFamille };
    }

    // ---------------------------------------------------------
    // 2. SOUS-TRAITANCE + CHARGES VARIABLES (= "Achats & charges externes variables")
    // ---------------------------------------------------------
    _calculerAchatsEtChargesVariables(periodes, ca) {
        const coeff = this.scenario.coefficients.charges;
        const sousTraitanceMensuel = Array(this.nbMois).fill(0);
        const detailParFournisseur = {};    // NEW : série mensuelle par fournisseur (pour l'UI détail)
        const chargesVarMensuel = Array(this.nbMois).fill(0);
        const detailChargesVar = {};

        // Sous-traitance : calcul du détail par fournisseur, puis agrégation
        this.projet.sousTraitance.forEach(s => {
            const serie = periodes.map(p => s.montantPourMois(p.index) * coeff);
            detailParFournisseur[s.id] = serie;
            serie.forEach((v, i) => { sousTraitanceMensuel[i] += v; });
        });

        const caParProduitAuMois = (i) => {
            const map = new Map();
            Object.entries(ca.detailParProduit).forEach(([pid, serie]) => map.set(pid, serie[i]));
            return map;
        };

        this.projet.chargesVariables.forEach(cv => {
            detailChargesVar[cv.id] = periodes.map(p => cv.montantPourMois(p.index, {
                caTotalMois: ca.totalMensuel[p.index],
                caParProduit: caParProduitAuMois(p.index)
            }) * coeff);
        });
        periodes.forEach(p => {
            Object.values(detailChargesVar).forEach(serie => chargesVarMensuel[p.index] += serie[p.index]);
        });

        const totalMensuel = periodes.map(p => sousTraitanceMensuel[p.index] + chargesVarMensuel[p.index]);

        return {
            sousTraitanceMensuel,
            detailParFournisseur,                                              // NEW
            totalAnnuelSousTraitance: this._agregerParAnnee(sousTraitanceMensuel, periodes), // NEW
            chargesVarMensuel, detailChargesVar, totalMensuel,
            totalAnnuel: this._agregerParAnnee(totalMensuel, periodes)
        };
    }

    // ---------------------------------------------------------
    // 3. CHARGES FIXES
    // ---------------------------------------------------------
    _calculerChargesFixes(periodes) {
        const coeff = this.scenario.coefficients.charges;
        const parCategorie = {};
        const totalMensuel = Array(this.nbMois).fill(0);

        this.projet.chargesFixes.forEach(cf => {
            parCategorie[cf.categorie] = parCategorie[cf.categorie] || Array(this.nbMois).fill(0);
            periodes.forEach(p => {
                const m = cf.montantPourMois(p.index) * coeff;
                parCategorie[cf.categorie][p.index] += m;
                totalMensuel[p.index] += m;
            });
        });

        return { parCategorie, totalMensuel, totalAnnuel: this._agregerParAnnee(totalMensuel, periodes) };
    }

    // ---------------------------------------------------------
    // 4. PERSONNEL
    // ---------------------------------------------------------
    _calculerPersonnel(periodes) {
        const coeff = this.scenario.coefficients.salaires;
        const detailParSalarie = {};
        const totalBrut = Array(this.nbMois).fill(0);
        const totalCharges = Array(this.nbMois).fill(0);
        const totalAnnexes = Array(this.nbMois).fill(0);
        const totalMensuel = Array(this.nbMois).fill(0);

        this.projet.personnel.forEach(sal => {
            const serie = periodes.map(p => {
                const c = sal.coutMensuel(p.dateISO, p.estDecembre);
                return { brut: c.brut * coeff, charges: c.charges * coeff, annexes: (c.annexes || 0) * coeff, total: c.total * coeff };
            });
            detailParSalarie[sal.id] = serie;
            serie.forEach((c, i) => {
                totalBrut[i] += c.brut; totalCharges[i] += c.charges; totalAnnexes[i] += c.annexes; totalMensuel[i] += c.total;
            });
        });

        return { detailParSalarie, totalBrut, totalCharges, totalAnnexes, totalMensuel, totalAnnuel: this._agregerParAnnee(totalMensuel, periodes) };
    }

    // ---------------------------------------------------------
    // 5. INVESTISSEMENTS & AMORTISSEMENTS
    // ---------------------------------------------------------
    _calculerInvestissements(periodes) {
        const coeff = this.scenario.coefficients.investissements;
        const dotationMensuelleTotale = Array(this.nbMois).fill(0);
        const detail = [];
        let valeurBruteTotale = 0, tvaDeductibleTotale = 0;

        this.projet.investissements.forEach(inv => {
            const montantHT = MathUtils.round2(inv.montantHT * coeff);
            valeurBruteTotale += montantHT;
            tvaDeductibleTotale += MathUtils.round2(montantHT * MathUtils.safeDivide(inv.tauxTVA, 100));

            const moisAcquisition = this._moisIndexDepuisDate(inv.dateAcquisition);
            const invPourCalcul = coeff === 1 ? inv : Object.assign(Object.create(Object.getPrototypeOf(inv)), inv, { montantHT });
            const { dotationMensuelle, vncMensuelle } = invPourCalcul.genererPlanAmortissementMensuel(this.nbMois, moisAcquisition);

            dotationMensuelle.forEach((v, i) => { dotationMensuelleTotale[i] += v; });
            detail.push({ investissement: inv, dotationMensuelle, vncMensuelle, montantHT, moisAcquisition });
        });

        const dotationAnnuelle = this._agregerParAnnee(dotationMensuelleTotale, periodes);

        const vncParAnnee = _.times(this.projet.entreprise.nbAnnees, (a) => {
            const dernierMoisAnnee = _.chain(periodes).filter(p => p.annee === a + 1).last().value()?.index ?? this.nbMois - 1;
            return MathUtils.sum(detail.map(d => d.vncMensuelle[dernierMoisAnnee] || 0));
        });

        return {
            dotationMensuelleTotale, dotationAnnuelle, vncParAnnee, detail,
            valeurBruteTotale: MathUtils.round2(valeurBruteTotale),
            tvaDeductibleTotale: MathUtils.round2(tvaDeductibleTotale)
        };
    }

    // ---------------------------------------------------------
    // 6. EMPRUNTS
    // ---------------------------------------------------------
    _calculerEmprunts() {
        const detail = this.projet.emprunts.map(e => ({ emprunt: e, tableau: e.genererTableauAmortissement() }));
        const interetsMensuel = Array(this.nbMois).fill(0);
        const capitalMensuel = Array(this.nbMois).fill(0);
        const crdMensuel = Array(this.nbMois).fill(0);
        const capitalEmprunteParMois = Array(this.nbMois).fill(0);

        detail.forEach(({ emprunt, tableau }) => {
            const moisDebut = this._moisIndexDepuisDate(emprunt.dateDebut);
            if (moisDebut >= 0 && moisDebut < this.nbMois) capitalEmprunteParMois[moisDebut] += emprunt.capital;
            tableau.forEach((ligne, idx) => {
                const m = moisDebut + idx;
                if (m >= 0 && m < this.nbMois) {
                    interetsMensuel[m] += ligne.interets;
                    capitalMensuel[m] += ligne.capitalRembourse;
                    crdMensuel[m] += ligne.crd;
                }
            });
        });

        return { detail, interetsMensuel, capitalMensuel, crdMensuel, capitalEmprunteParMois };
    }

    _moisIndexDepuisDate(dateISO) {
        const debutActivite = new Date(this.projet.entreprise.dateDebutActivite);
        const d = new Date(dateISO);
        return (d.getFullYear() - debutActivite.getFullYear()) * 12 + (d.getMonth() - debutActivite.getMonth());
    }

    // ---------------------------------------------------------
    // 7. FISCALITÉ (TVA, IS, CFE, CVAE)
    // ---------------------------------------------------------
    _calculerFiscalite(periodes, ca, achats, chargesFixes, personnel, empruntsCalc) {
        const tvaAssujetti = this.projet.entreprise.tva;
        const tvaCollectee = Array(this.nbMois).fill(0);
        const tvaDeductible = Array(this.nbMois).fill(0);
        const tvaAPayer = Array(this.nbMois).fill(0);
        let creditReporte = 0;

        if (tvaAssujetti) {
            this.projet.produits.forEach(p => {
                periodes.forEach(per => {
                    tvaCollectee[per.index] += p.caMensuelHT(per.index) * (p.tauxTVA / 100) * this.scenario.coefficients.ca;
                });
            });
            periodes.forEach(per => {
                tvaDeductible[per.index] += achats.totalMensuel[per.index] * 0.20; // taux moyen simplifié
                tvaDeductible[per.index] += chargesFixes.totalMensuel[per.index] * 0.20;
            });
            // TVA déductible sur investissements le mois d'acquisition
            this.projet.investissements.forEach(inv => {
                const m = this._moisIndexDepuisDate(inv.dateAcquisition);
                if (m >= 0 && m < this.nbMois) tvaDeductible[m] += inv.montantHT * (inv.tauxTVA / 100);
            });
            periodes.forEach(per => {
                let solde = tvaCollectee[per.index] - tvaDeductible[per.index] - creditReporte;
                if (solde < 0) { creditReporte = -solde; tvaAPayer[per.index] = 0; }
                else { tvaAPayer[per.index] = solde; creditReporte = 0; }
            });
        }

        // CFE : approximation paramétrable = taux × CA annuel (simplification documentée)
        const cfeAnnuelle = ca.totalAnnuel.map(caN => caN * (this.projet.entreprise.tauxCFE / 100));
        // CVAE : due si CA > 500K€ (simplification : 0.75% de la VA au-delà du seuil)
        const cvaeAnnuelle = ca.totalAnnuel.map(caN => caN > 500000 ? caN * 0.0075 : 0);

        return { tvaCollectee, tvaDeductible, tvaAPayer, cfeAnnuelle, cvaeAnnuelle };
    }

    /** Calcul IS avec barème PME (15% jusqu'à 42 500€, 25% au-delà) */
    _calculerIS(resultatFiscalAnnuel) {
        if (resultatFiscalAnnuel <= 0) return 0;
        const seuil = 42500;
        if (resultatFiscalAnnuel <= seuil) return resultatFiscalAnnuel * (this.projet.entreprise.tauxIS / 100);
        return seuil * (this.projet.entreprise.tauxIS / 100) + (resultatFiscalAnnuel - seuil) * 0.25;
    }

    // ---------------------------------------------------------
    // 8. BESOIN EN FONDS DE ROULEMENT
    // ---------------------------------------------------------
    _calculerBFR(periodes, ca, achats) {
        const { delaiClientJours, delaiFournisseurJours, delaiStockJours, tauxStockSurCA } = this.projet.bfr;
        const coeffDelais = this.scenario.coefficients.delaisPaiement;

        const creancesClients = periodes.map(p => {
            const caTTCMois = ca.totalMensuel[p.index] * 1.20; // TVA moyenne simplifiée
            return caTTCMois * (delaiClientJours * coeffDelais / 30);
        });
        const dettesFournisseurs = periodes.map(p => {
            const achatsTTC = achats.totalMensuel[p.index] * 1.20;
            return achatsTTC * (delaiFournisseurJours * coeffDelais / 30);
        });

        // Valorisation des stocks : priorité au délai de rotation (basé sur les achats),
        // sinon repli sur le taux forfaitaire de CA (méthode simplifiée pour les services).
        const stocks = periodes.map(p => {
            if (delaiStockJours > 0) {
                return achats.totalMensuel[p.index] * (delaiStockJours * coeffDelais / 30);
            }
            return ca.totalMensuel[p.index] * (tauxStockSurCA / 100);
        });

        const bfrMensuel = periodes.map(p => creancesClients[p.index] + stocks[p.index] - dettesFournisseurs[p.index]);
        const variationBfrMensuel = bfrMensuel.map((v, i) => i === 0 ? v : v - bfrMensuel[i - 1]);

        return { creancesClients, dettesFournisseurs, stocks, bfrMensuel, variationBfrMensuel };
    }
    // ---------------------------------------------------------
    // 9. COMPTE DE RÉSULTAT / SIG
    // ---------------------------------------------------------
    _calculerCompteResultat(periodes, ca, achats, chargesFixes, personnel, investAmort, empruntsCalc, fiscalite) {
        const nbAnnees = this.projet.entreprise.nbAnnees;
        const lignes = [];

        for (let a = 0; a < nbAnnees; a++) {
            const idxMois = periodes.filter(p => p.annee === a + 1).map(p => p.index);
            const sum = arr => idxMois.reduce((s, i) => s + (arr[i] || 0), 0);

            const production = sum(ca.totalMensuel);
            const consommationsExternes = sum(achats.totalMensuel) + sum(chargesFixes.totalMensuel);
            const valeurAjoutee = production - consommationsExternes;
            const impotsEtTaxes = (fiscalite.cfeAnnuelle[a] || 0) + (fiscalite.cvaeAnnuelle[a] || 0);
            const chargesPersonnel = sum(personnel.totalMensuel);
            const ebe = valeurAjoutee - impotsEtTaxes - chargesPersonnel;
            const dotationsAmortissements = investAmort.dotationAnnuelle[a] || 0;
            const resultatExploitation = ebe - dotationsAmortissements;
            const chargesFinancieres = sum(empruntsCalc.interetsMensuel);
            const resultatCourantAvantImpot = resultatExploitation - chargesFinancieres;
            const resultatExceptionnel = 0;
            const resultatAvantIS = resultatCourantAvantImpot + resultatExceptionnel;
            const is = this._calculerIS(resultatAvantIS);
            const resultatNet = resultatAvantIS - is;
            const caf = resultatNet + dotationsAmortissements;
            const margeBrute = production - achats.totalMensuel.reduce((s, i) => s, 0) - sum(achats.sousTraitanceMensuel);

            lignes.push({
                annee: a + 1, production, consommationsExternes, valeurAjoutee, impotsEtTaxes,
                chargesPersonnel, ebe, dotationsAmortissements, resultatExploitation,
                chargesFinancieres, resultatCourantAvantImpot, resultatExceptionnel,
                resultatAvantIS, is, resultatNet, caf,
                margeBrute: production - sum(achats.totalMensuel)
            });
        }
        return { parAnnee: lignes };
    }

    // ---------------------------------------------------------
    // 10. TRÉSORERIE MENSUELLE
    // ---------------------------------------------------------
    _calculerTresorerie(periodes, ca, achats, chargesFixes, personnel, investAmort, empruntsCalc, fiscalite, compteResultat) {
        const encaissements = Array(this.nbMois).fill(0);
        const decaissements = Array(this.nbMois).fill(0);
        const detail = [];

        // Encaissements clients décalés du délai client (approx : mois même + report simplifié via BFR déjà géré au bilan)
        periodes.forEach(p => { encaissements[p.index] += ca.totalMensuel[p.index] * 1.20; });

        // Apports & emprunts
        this.projet.apports.forEach(ap => { if (ap.moisIndex < this.nbMois) encaissements[ap.moisIndex] += ap.montant; });
        empruntsCalc.capitalEmprunteParMois.forEach((v, i) => encaissements[i] += v);

        // Décaissements : achats, charges fixes, personnel, TVA, IS, remboursements emprunts, investissements
        periodes.forEach(p => {
            decaissements[p.index] += achats.totalMensuel[p.index] * 1.20;
            decaissements[p.index] += chargesFixes.totalMensuel[p.index] * 1.20;
            decaissements[p.index] += personnel.totalMensuel[p.index];
            decaissements[p.index] += fiscalite.tvaAPayer[p.index] || 0;
            decaissements[p.index] += empruntsCalc.interetsMensuel[p.index] + empruntsCalc.capitalMensuel[p.index];
        });
        // IS payé en année N+1 (simplification: payé au dernier mois de chaque année)
        compteResultat.parAnnee.forEach((ligne, a) => {
            const dernierMoisAnnee = periodes.filter(p => p.annee === a + 1).pop();
            if (dernierMoisAnnee) decaissements[dernierMoisAnnee.index] += Math.max(0, ligne.is);
        });
        // CFE
        fiscalite.cfeAnnuelle.forEach((montant, a) => {
            const dernierMoisAnnee = periodes.filter(p => p.annee === a + 1).pop();
            if (dernierMoisAnnee) decaissements[dernierMoisAnnee.index] += montant;
        });
        // Investissements (TTC) au mois d'acquisition
        this.projet.investissements.forEach(inv => {
            const m = this._moisIndexDepuisDate(inv.dateAcquisition);
            if (m >= 0 && m < this.nbMois) decaissements[m] += inv.montantHT * (1 + inv.tauxTVA / 100);
        });

        let soldeCumule = this.projet.tresorerieInitiale;
        periodes.forEach(p => {
            const soldeMensuel = encaissements[p.index] - decaissements[p.index];
            soldeCumule += soldeMensuel;
            detail.push({ ...p, encaissements: encaissements[p.index], decaissements: decaissements[p.index], soldeMensuel, soldeCumule, alerte: soldeCumule < 0 });
        });

        return { detail, encaissements, decaissements, soldeCumuleFinal: soldeCumule };
    }

    // ---------------------------------------------------------
    // 11. BILAN (toujours équilibré par construction)
    // ---------------------------------------------------------
    _calculerBilan(periodes, investAmort, empruntsCalc, tresorerie, bfr, compteResultat) {
        const nbAnnees = this.projet.entreprise.nbAnnees;
        const bilansAnnuels = [];
        let capitalPropreCumule = _.sumBy(this.projet.apports.filter(a => ['capital'].includes(a.type)), 'montant');
        let reservesCumulees = 0;
        let cca = _.sumBy(this.projet.apports.filter(a => a.type === 'ccaAssocie'), 'montant');
        let subventionsCumulees = _.sumBy(this.projet.apports.filter(a => a.type === 'subvention'), 'montant');

        for (let a = 0; a < nbAnnees; a++) {
            const dernierMoisIdx = periodes.filter(p => p.annee === a + 1).pop().index;
            const immobilisationsBrutes = investAmort.valeurBruteTotale;
            const amortissementsCumules = _.sumBy(investAmort.dotationAnnuelle.slice(0, a + 1), x => x);
            const immobilisationsNettes = Math.max(0, immobilisationsBrutes - amortissementsCumules);

            const creancesClients = bfr.creancesClients[dernierMoisIdx];
            const stocks = bfr.stocks[dernierMoisIdx];
            const disponibilites = tresorerie.detail[dernierMoisIdx].soldeCumule;
            const totalActif = immobilisationsNettes + creancesClients + stocks + disponibilites;

            const resultatExercice = compteResultat.parAnnee[a].resultatNet;
            if (a > 0) reservesCumulees += compteResultat.parAnnee[a - 1].resultatNet;
            const capitauxPropres = capitalPropreCumule + reservesCumulees + resultatExercice + subventionsCumulees;

            const dettesFinancieresLT = empruntsCalc.crdMensuel[dernierMoisIdx] + cca;
            const dettesFournisseurs = bfr.dettesFournisseurs[dernierMoisIdx];
            const dettesFiscalesSociales = 0; // simplifié : soldé mensuellement dans la trésorerie
            const totalPassif = capitauxPropres + dettesFinancieresLT + dettesFournisseurs + dettesFiscalesSociales;

            bilansAnnuels.push({
                annee: a + 1,
                actif: { immobilisationsNettes, creancesClients, stocks, disponibilites, total: totalActif },
                passif: { capitauxPropres, dettesFinancieresLT, dettesFournisseurs, dettesFiscalesSociales, total: totalPassif },
                equilibre: Math.abs(totalActif - totalPassif) < 1 // tolérance d'arrondi 1€
            });
        }
        return { parAnnee: bilansAnnuels };
    }

    // ---------------------------------------------------------
    // 12. PLAN DE FINANCEMENT
    // ---------------------------------------------------------
    _calculerPlanFinancement(periodes, investAmort, empruntsCalc, compteResultat, bfr) {
        const nbAnnees = this.projet.entreprise.nbAnnees;
        const lignes = [];
        for (let a = 0; a < nbAnnees; a++) {
            const idxMois = periodes.filter(p => p.annee === a + 1).map(p => p.index);
            const emplois = {
                investissements: this.projet.investissements
                    .filter(inv => idxMois.includes(this._moisIndexDepuisDate(inv.dateAcquisition)))
                    .reduce((s, inv) => s + inv.montantHT, 0),
                variationBFR: Math.max(0, _.sumBy(idxMois, i => bfr.variationBfrMensuel[i])),
                remboursementCapital: _.sumBy(idxMois, i => empruntsCalc.capitalMensuel[i])
            };
            const ressources = {
                caf: compteResultat.parAnnee[a].caf,
                apports: _.sumBy(this.projet.apports.filter(ap => idxMois.includes(ap.moisIndex)), 'montant'),
                nouveauxEmprunts: _.sumBy(idxMois, i => empruntsCalc.capitalEmprunteParMois[i])
            };
            const totalEmplois = _.sum(Object.values(emplois));
            const totalRessources = _.sum(Object.values(ressources));
            lignes.push({ annee: a + 1, emplois, ressources, totalEmplois, totalRessources, solde: totalRessources - totalEmplois });
        }
        return { parAnnee: lignes };
    }

    // ---------------------------------------------------------
    // 13. RATIOS FINANCIERS
    // ---------------------------------------------------------
    _calculerRatios(periodes, compteResultat, bilan, bfr, empruntsCalc, chargesFixes, achats) {
        const nbAnnees = this.projet.entreprise.nbAnnees;
        const investissementTotal = this._investissementTotal();
        const moisParAnnee = Array.from({ length: nbAnnees }, () => []);

        for (const p of periodes) { if (p.annee <= nbAnnees) moisParAnnee[p.annee - 1].push(p.index); }

        const ratios = [];

        for (let a = 0; a < nbAnnees; a++) {
            const cr = compteResultat.parAnnee[a];
            const bil = bilan.parAnnee[a];
            const idxMois = moisParAnnee[a];
            const dernierIdx = idxMois[idxMois.length - 1];
            const frng = (bil.passif.capitauxPropres + bil.passif.dettesFinancieresLT) - bil.actif.immobilisationsNettes;
            const bfrFin = bfr.bfrMensuel[dernierIdx];
            const passifCP = bil.passif.capitauxPropres;
            const prod = cr.production;
            let chargeFixeAnnuelle = 0, achatsAnnuels = 0, annuiteEmprunt = 0;

            for (const idx of idxMois) {
                chargeFixeAnnuelle += chargesFixes.totalMensuel[idx];
                achatsAnnuels += achats.totalMensuel[idx];
                annuiteEmprunt += empruntsCalc.interetsMensuel[idx] + empruntsCalc.capitalMensuel[idx];
            }

            const tauxMargeSurCV = prod > 0 ? (prod - achatsAnnuels) / prod : 0;

            ratios.push({
                annee: a + 1,
                caf: cr.caf,
                bfr: bfrFin,
                frng,
                tresorerieNette: frng - bfrFin,
                ebe: cr.ebe,
                margeCommerciale: prod > 0 ? (cr.margeBrute / prod) * 100 : 0,
                rentabiliteNette: prod > 0 ? (cr.resultatNet / prod) * 100 : 0,
                roi: investissementTotal > 0 ? (cr.resultatNet / investissementTotal) * 100 : null,
                roe: passifCP > 0 ? (cr.resultatNet / passifCP) * 100 : null,
                seuilRentabilite: tauxMargeSurCV > 0 ? chargeFixeAnnuelle / tauxMargeSurCV : null,
                dscr: annuiteEmprunt > 0 ? cr.caf / annuiteEmprunt : null,
                capaciteRemboursement: cr.caf > 0 ? bil.passif.dettesFinancieresLT / cr.caf : null
            });
        }

        return { parAnnee: ratios };
    }

    _investissementTotal() { return _.sumBy(this.projet.investissements, 'montantHT'); }

    // ---------------------------------------------------------
    // UTILITAIRE
    // ---------------------------------------------------------
    _agregerParAnnee(serieMensuelle, periodes) {
        const res = Array(this.projet.entreprise.nbAnnees).fill(0);
        periodes.forEach(p => { res[p.annee - 1] += serieMensuelle[p.index]; });
        return res;
    }
}

export class ValidationEngine {
    constructor(projet, resultats) {
        this.projet = projet;
        this.resultats = resultats;
    }

    /** Validates all business rules and consistency checks across project and results data. */
    validerTout() {
        const err = [];
        const { projet: p, resultats: r } = this;

        p.produits.forEach(x => {
            if (!x.nom) err.push({ type: 'warning', module: 'Produits', message: `Produit sans nom (id ${x.id})` });
            if (x.prixHT < 0) err.push({ type: 'error', module: 'Produits', message: `Prix négatif sur "${x.nom}"` });
            if (x.tauxTVA < 0 || x.tauxTVA > 25) err.push({ type: 'error', module: 'Produits', message: `TVA incohérente sur "${x.nom}" (${x.tauxTVA}%)` });
        });

        p.sousTraitance.forEach(s => {
            if (!s.fournisseur) err.push({ type: 'warning', module: 'Sous-traitance', message: `Prestataire sans nom (id ${s.id})` });
            if (s.montantMensuel < 0) err.push({ type: 'error', module: 'Sous-traitance', message: `Montant négatif pour "${s.fournisseur || 'prestataire sans nom'}"` });
            if (s.tauxTVA < 0 || s.tauxTVA > 25) err.push({ type: 'error', module: 'Sous-traitance', message: `TVA incohérente pour "${s.fournisseur}" (${s.tauxTVA}%)` });
        });

        p.personnel.forEach(s => {
            if (s.salaireBrutMensuel < 0) err.push({ type: 'error', module: 'Personnel', message: `Salaire négatif pour ${s.nom}` });
            if (s.tauxChargesPatronales < 0 || s.tauxChargesPatronales > 100) err.push({ type: 'error', module: 'Personnel', message: `Taux de charges incohérent pour ${s.nom}` });
        });

        const b = p.bfr;
        if (b.delaiClientJours < 0 || b.delaiClientJours > 365) err.push({ type: 'error', module: 'BFR', message: `Délai de paiement clients incohérent (${b.delaiClientJours} jours)` });
        if (b.delaiFournisseurJours < 0 || b.delaiFournisseurJours > 365) err.push({ type: 'error', module: 'BFR', message: `Délai de paiement fournisseurs incohérent (${b.delaiFournisseurJours} jours)` });
        if (b.tauxStockSurCA < 0 || b.tauxStockSurCA > 100) err.push({ type: 'error', module: 'BFR', message: `Taux de stock sur CA incohérent (${b.tauxStockSurCA}%)` });
        if (r.bfr.bfrMensuel.some(v => v < -1000000)) err.push({ type: 'warning', module: 'BFR', message: `Le BFR est fortement négatif, vérifiez la cohérence des délais fournisseurs/clients.` });

        if (p.entreprise.tva && r.fiscalite.tvaAPayer.some(isNaN)) err.push({ type: 'error', module: 'Fiscalité', message: 'Calcul TVA invalide (NaN détecté)' });

        const moisNegatifs = r.tresorerie.detail.filter(m => m.alerte).length;
        if (moisNegatifs) err.push({ type: 'warning', module: 'Trésorerie', message: `Trésorerie négative sur ${moisNegatifs} mois — risque de cessation de paiement.` });

        r.bilan.parAnnee.forEach(b => {
            if (!b.equilibre) err.push({ type: 'error', module: 'Bilan', message: `Bilan déséquilibré année ${b.annee} (écart ${(b.actif.total - b.passif.total).toFixed(2)} €)` });
        });

        return err;
    }
    
    _validerProduits() {
        const err = [];
        this.projet.produits.forEach(p => {
            if (!p.nom) err.push({ type: 'warning', module: 'Produits', message: `Produit sans nom (id ${p.id})` });
            if (p.prixHT < 0) err.push({ type: 'error', module: 'Produits', message: `Prix négatif sur "${p.nom}"` });
            if (p.tauxTVA < 0 || p.tauxTVA > 25) err.push({ type: 'error', module: 'Produits', message: `TVA incohérente sur "${p.nom}" (${p.tauxTVA}%)` });
            // GARDE-FOU carnet de commande : évite qu'un produit passe silencieusement à 0 de CA
            // si l'utilisateur a activé le mode manuel sans jamais remplir la grille.
            if (p.modeSaisieQuantite === 'carnetCommande' && _.sum(p.carnetCommande) === 0) {
                err.push({ type: 'warning', module: 'Produits', message: `Carnet de commande vide pour "${p.nom}" — aucune vente saisie sur la période.` });
            }
        });
        return err;
    }
}