// ============================================================
// UI.JS — Couche présentation pure. Ne calcule RIEN : lit
// `store.resultats` (produits par calculs.js) et le `projet`.
// ============================================================
import { Produit, ChargeFixe, ChargeVariable, Salarie, Investissement, Emprunt, Apport, SousTraitance, CATEGORIES_CHARGES_FIXES } from './models.js';

export class UIManager {
  constructor(store) {
    this.store = store; // { projet, engine, resultats, bus }
    this.moduleActif = 'parametres';
    this.modeExpert = true;
    this.modules = [
      { id: 'parametres', label: '⚙️ Paramètres généraux', groupe: 'Configuration' },
      { id: 'produits', label: '📦 Produits / Services', groupe: 'Exploitation' },
      { id: 'ca', label: '💶 Chiffre d\'affaires', groupe: 'Exploitation' },
      { id: 'soustraitance', label: '🤝 Sous-traitance', groupe: 'Exploitation' },
      { id: 'chargesVariables', label: '📉 Charges variables', groupe: 'Exploitation' },
      { id: 'chargesFixes', label: '📌 Charges fixes', groupe: 'Exploitation' },
      { id: 'personnel', label: '👥 Personnel', groupe: 'RH' },
      { id: 'investissements', label: '🏗️ Investissements', groupe: 'Financement' },
      { id: 'emprunts', label: '🏦 Emprunts', groupe: 'Financement' },
      { id: 'apports', label: '💰 Apports', groupe: 'Financement' },
      { id: 'bfr', label: '🔄 BFR', groupe: 'Financement' },
      { id: 'compteResultat', label: '📊 Compte de résultat', groupe: 'États financiers' },
      { id: 'bilan', label: '⚖️ Bilan', groupe: 'États financiers' },
      { id: 'tresorerie', label: '💧 Trésorerie', groupe: 'États financiers' },
      { id: 'planFinancement', label: '📐 Plan de financement', groupe: 'États financiers' },
      { id: 'ratios', label: '📈 Ratios & indicateurs', groupe: 'Analyse' },
      { id: 'graphiques', label: '📉 Graphiques', groupe: 'Analyse' },
    ];
  }

  init() {
    this._renderSidebar();
    this.navigateTo('parametres');
    $('#sidebar-nav').on('click', '.nav-item', (e) => this.navigateTo($(e.currentTarget).data('id')));
  }

  _renderSidebar() {
    const groupes = _.groupBy(this.modules, 'groupe');
    let html = '';
    Object.entries(groupes).forEach(([groupe, items]) => {
      html += `<div class="nav-group-title">${groupe}</div>`;
      items.forEach(m => html += `<div class="nav-item" data-id="${m.id}">${m.label}</div>`);
    });
    $('#sidebar-nav').html(html);
  }

  navigateTo(id) {
    this.moduleActif = id;
    $('.nav-item').removeClass('active');
    $(`.nav-item[data-id="${id}"]`).addClass('active');
    this.render();
  }

  /** Rendu principal : appelé après chaque recalcul */
  render() {
    const map = {
      parametres: () => this._renderParametres(),
      produits: () => this._renderProduits(),
      ca: () => this._renderCA(),
      soustraitance: () => this._renderSoustraitance(),
      chargesFixes: () => this._renderChargesFixes(),
      chargesVariables: () => this._renderChargesVariables(),
      personnel: () => this._renderPersonnel(),
      investissements: () => this._renderInvestissements(),
      emprunts: () => this._renderEmprunts(),
      apports: () => this._renderApports(),
      bfr: () => this._renderBFR(),
      compteResultat: () => this._renderCompteResultat(),
      bilan: () => this._renderBilan(),
      tresorerie: () => this._renderTresorerie(),
      planFinancement: () => this._renderPlanFinancement(),
      ratios: () => this._renderRatios(),
      graphiques: () => this._renderGraphiques(),
    };

    const fn = map[this.moduleActif] || (() => {
      $('#main-content').html(`<div class="card">Module "${this.moduleActif}" — en construction.</div>`);
    });

    try {
      fn();
    } catch (err) {
      console.error(`[UIManager] Erreur lors du rendu du module "${this.moduleActif}"`, err);
      $('#main-content').html(`
      <div class="card render-error-card">
        <h3>🛑 Erreur d'affichage — module "${this.moduleActif}"</h3>
        <p><strong>${err.message}</strong></p>
        <p style="font-size:12px;color:var(--text-muted);">
          Cette erreur vient très probablement d'une incohérence entre <code>calculs.js</code>
          et <code>models.js</code> (méthode renommée, paramètre manquant, champ absent
          dans l'objet <code>resultats</code>). Copiez la stack ci-dessous pour investiguer.
        </p>
        <pre>${err.stack}</pre>
      </div>
    `);
    }
  }

  _fmt(n) { return (n || 0).toLocaleString('fr-FR', { maximumFractionDigits: 0 }) + ' €'; }
  _fmtPct(n) { return (n || 0).toFixed(1) + ' %'; }

  // ---------------------------------------------------------
  // MODULE : PARAMÈTRES GÉNÉRAUX
  // ---------------------------------------------------------
  _renderParametres() {
    const e = this.store.projet.entreprise;
    $('#main-content').html(`
      <div class="card">
        <h3>Identité de l'entreprise</h3>
        <div class="grid-3">
          <div><label>Nom</label><input id="p-nom" value="${e.nom}"></div>
          <div><label>Forme juridique</label><input id="p-forme" value="${e.formeJuridique}"></div>
          <div><label>Devise</label><input id="p-devise" value="${e.devise}"></div>
          <div><label>Date création</label><input type="date" id="p-datecreation" value="${e.dateCreation}"></div>
          <div><label>Date début activité</label><input type="date" id="p-datedebut" value="${e.dateDebutActivite}"></div>
          <div><label>Durée prévisionnel (années)</label><input type="number" min="1" max="5" id="p-nbannees" value="${e.nbAnnees}"></div>
        </div>
      </div>
      <div class="card">
        <h3>Fiscalité & charges</h3>
        <div class="grid-4">
          <div><label>TVA assujetti</label><select id="p-tva"><option value="1" ${e.tva ? 'selected' : ''}>Oui</option><option value="0" ${!e.tva ? 'selected' : ''}>Non</option></select></div>
          <div><label>Taux IS (%)</label><input type="number" id="p-is" value="${e.tauxIS}"></div>
          <div><label>Taux CFE (%)</label><input type="number" id="p-cfe" value="${e.tauxCFE}"></div>
          <div><label>Charges sociales TNS (%)</label><input type="number" id="p-cs" value="${e.tauxChargesSociales}"></div>
        </div>
      </div>
      <div class="card">
        <h3>Hypothèses économiques</h3>
        <div class="grid-3">
          <div><label>Inflation (%/an)</label><input type="number" id="p-inflation" value="${e.hypotheses.inflation}"></div>
          <div><label>Indexation (%/an)</label><input type="number" id="p-indexation" value="${e.hypotheses.indexation}"></div>
          <div><label>Croissance cible (%/an)</label><input type="number" id="p-croissance" value="${e.hypotheses.croissance}"></div>
        </div>
      </div>
    `);
    $('#main-content input, #main-content select').on('change', () => {
      e.nom = $('#p-nom').val(); e.formeJuridique = $('#p-forme').val(); e.devise = $('#p-devise').val();
      e.dateCreation = $('#p-datecreation').val(); e.dateDebutActivite = $('#p-datedebut').val();
      e.nbAnnees = +$('#p-nbannees').val(); e.tva = $('#p-tva').val() === '1';
      e.tauxIS = +$('#p-is').val(); e.tauxCFE = +$('#p-cfe').val(); e.tauxChargesSociales = +$('#p-cs').val();
      e.hypotheses.inflation = +$('#p-inflation').val(); e.hypotheses.indexation = +$('#p-indexation').val(); e.hypotheses.croissance = +$('#p-croissance').val();
      this.store.bus.emit('data:changed');
    });
  }

  // ---------------------------------------------------------
// MODULE : PRODUITS (avec choix Croissance auto / Carnet de commande)
// ---------------------------------------------------------
_renderProduits() {
  const produits = this.store.projet.produits;

  const rows = produits.map(p => {
    const totalAn1 = this._fmt(_.sum(this.store.resultats?.ca.detailParProduit[p.id]?.slice(0, 12) || []));

    // Zone "Quantités" conditionnelle selon le mode de saisie choisi pour ce produit
    const zoneQuantite = p.modeSaisieQuantite === 'carnetCommande'
      ? `<button class="btn-ghost btn-edit-carnet" data-id="${p.id}">
           📅 ${_.sum(p.carnetCommande.slice(0, 12)).toLocaleString('fr-FR')} u. — An.1
         </button>`
      : `<div class="qty-croissance-inputs">
           <input class="edit" type="number" data-f="quantiteMensuelle" value="${p.quantiteMensuelle}" title="Quantité mensuelle de base">
           <input class="edit" type="number" data-f="tauxCroissance" value="${p.tauxCroissance}" title="Croissance annuelle %">
         </div>`;

    return `
      <tr data-id="${p.id}">
        <td><input class="edit" data-f="nom" value="${p.nom}"></td>
        <td><input class="edit" data-f="famille" value="${p.famille}"></td>
        <td><input class="edit" type="number" data-f="prixHT" value="${p.prixHT}"></td>
        <td><input class="edit" type="number" data-f="tauxTVA" value="${p.tauxTVA}"></td>
        <td>
          <select class="edit" data-f="modeVente">
            ${['mensuel','ponctuel','abonnement','saisonnier'].map(m => `<option ${p.modeVente===m?'selected':''}>${m}</option>`).join('')}
          </select>
        </td>
        <td>
          <select class="edit mode-saisie-select" data-f="modeSaisieQuantite">
            <option value="croissance" ${p.modeSaisieQuantite !== 'carnetCommande' ? 'selected' : ''}>Croissance auto</option>
            <option value="carnetCommande" ${p.modeSaisieQuantite === 'carnetCommande' ? 'selected' : ''}>Carnet de commande</option>
          </select>
        </td>
        <td>${zoneQuantite}</td>
        <td><input class="edit" type="number" data-f="remiseMoyenne" value="${p.remiseMoyenne}"></td>
        <td>${totalAn1}</td>
        <td><button class="btn-danger btn-del">🗑</button></td>
      </tr>`;
  }).join('');

  $('#main-content').html(`
    <div class="card">
      <h3>Produits / Services <button id="btn-add-produit" class="btn-primary" style="float:right">+ Ajouter</button></h3>
      <p class="muted">
        💡 <strong>Croissance auto</strong> : une quantité de base + un taux de croissance annuel appliqué automatiquement (adapté aux modèles SaaS/abonnement réguliers).
        <strong>Carnet de commande</strong> : vous saisissez vous-même le nombre d'unités vendues chaque mois, pour un pilotage précis
        (recommandé pour les ventes irrégulières, projets B2B, activité saisonnière marquée).
      </p>
      <table class="fin-table">
        <thead>
          <tr>
            <th>Nom</th><th>Famille</th><th>Prix HT</th><th>TVA %</th>
            <th>Mode de vente</th><th>Mode de saisie</th><th>Quantités</th>
            <th>Remise %</th><th>CA An.1</th><th></th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`);

  $('#btn-add-produit').on('click', () => {
    const nbMois = this.store.projet.entreprise.nbAnnees * 12;
    this.store.projet.produits.push(new Produit({ carnetCommande: Array(nbMois).fill(0) }));
    this.store.bus.emit('data:changed');
  });

  $('.btn-del').on('click', (e) => {
    const id = $(e.currentTarget).closest('tr').data('id');
    this.store.projet.produits = this.store.projet.produits.filter(p => p.id !== id);
    this.store.bus.emit('data:changed');
  });

  $('.btn-edit-carnet').on('click', (e) => {
    this._ouvrirCarnetCommande($(e.currentTarget).data('id'));
  });

  $('.edit').on('change', (e) => {
    const id = $(e.currentTarget).closest('tr').data('id');
    const produit = this.store.projet.produits.find(p => p.id === id);
    const field = $(e.currentTarget).data('f');
    produit[field] = e.currentTarget.type === 'number' ? +e.currentTarget.value : e.currentTarget.value;
    this.store.bus.emit('data:changed');
  });
}

/**
 * Ouvre le modal de saisie du carnet de commande pour un produit donné.
 * Grille mensuelle par année, avec copier/coller Excel et duplication d'année.
 */
_ouvrirCarnetCommande(produitId) {
  const produit = this.store.projet.produits.find(p => p.id === produitId);
  if (!produit) return;

  const nbAnnees = this.store.projet.entreprise.nbAnnees;
  const nbMois = nbAnnees * 12;
  produit.assurerTailleCarnet(nbMois); // sécurité même avant tout recalcul

  const moisLabels = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];

  let html = `
    <div class="wizard-card carnet-modal">
      <h2>📅 Carnet de commande — ${produit.nom}</h2>
      <p class="muted">Saisissez le nombre d'unités vendues chaque mois. Ces valeurs remplacent le calcul automatique par croissance.</p>

      <div class="carnet-actions">
        <button id="carnet-paste-btn" class="btn-ghost">📋 Coller depuis Excel</button>
        <button id="carnet-clear-btn" class="btn-ghost">🗑 Réinitialiser à 0</button>
      </div>

      <div id="carnet-paste-zone" class="hidden">
        <textarea id="carnet-paste-input" rows="3" placeholder="Collez ici une plage de cellules copiée depuis Excel (une valeur par mois, dans l'ordre chronologique)"></textarea>
        <button id="carnet-paste-apply" class="btn-primary">Appliquer</button>
      </div>
  `;

  for (let a = 0; a < nbAnnees; a++) {
    html += `<h4>Année ${a + 1}</h4><div class="carnet-grid">`;
    for (let m = 0; m < 12; m++) {
      const idx = a * 12 + m;
      html += `
        <div class="carnet-cell">
          <label>${moisLabels[m]}</label>
          <input type="number" min="0" step="1" class="carnet-input" data-index="${idx}" value="${produit.carnetCommande[idx] ?? 0}">
        </div>`;
    }
    if (a < nbAnnees - 1) {
      html += `<button class="btn-ghost btn-dupliquer-annee" data-annee="${a}">↩ Dupliquer vers Année ${a + 2}</button>`;
    }
    html += `</div>`;
  }

  const totalGeneral = _.sum(produit.carnetCommande.slice(0, nbMois));
  html += `
      <div class="carnet-total">Total sur la période : ${totalGeneral.toLocaleString('fr-FR')} unités</div>
      <div class="wizard-actions">
        <button id="carnet-fermer" class="btn-primary">Valider et fermer</button>
      </div>
    </div>
  `;

  $('#carnet-modal-overlay').html(html).removeClass('hidden');
  this._bindCarnetModal(produit, nbMois, produitId);
}

/** Binding des interactions du modal Carnet de commande (édition, copier/coller, duplication) */
_bindCarnetModal(produit, nbMois, produitId) {
  $('.carnet-input').on('change', (e) => {
    const idx = +$(e.currentTarget).data('index');
    produit.carnetCommande[idx] = Math.max(0, +e.currentTarget.value || 0);
    const total = _.sum(produit.carnetCommande.slice(0, nbMois));
    $('.carnet-total').text(`Total sur la période : ${total.toLocaleString('fr-FR')} unités`);
  });

  $('.btn-dupliquer-annee').on('click', (e) => {
    const annee = +$(e.currentTarget).data('annee');
    for (let m = 0; m < 12; m++) {
      produit.carnetCommande[(annee + 1) * 12 + m] = produit.carnetCommande[annee * 12 + m];
    }
    this._ouvrirCarnetCommande(produitId); // re-render du modal avec les valeurs dupliquées
  });

  $('#carnet-paste-btn').on('click', () => $('#carnet-paste-zone').toggleClass('hidden'));

  $('#carnet-paste-apply').on('click', () => {
    const texte = $('#carnet-paste-input').val();
    // Gère le collage Excel horizontal (tabulations) ou vertical (retours à la ligne)
    const valeurs = texte.split(/[\t\n]+/)
      .map(v => parseFloat(v.replace(',', '.')))
      .filter(v => !isNaN(v));
    valeurs.forEach((v, i) => { if (i < produit.carnetCommande.length) produit.carnetCommande[i] = Math.max(0, v); });
    this._ouvrirCarnetCommande(produitId);
  });

  $('#carnet-clear-btn').on('click', () => {
    produit.carnetCommande = Array(nbMois).fill(0);
    this._ouvrirCarnetCommande(produitId);
  });

  $('#carnet-fermer').on('click', () => {
    $('#carnet-modal-overlay').addClass('hidden').empty();
    this.store.bus.emit('data:changed'); // déclenche le recalcul global une fois la saisie terminée
  });
}

  // ---------------------------------------------------------
  // MODULE : CA — vues mensuelle/annuelle + graphique
  // ---------------------------------------------------------
  _renderCA() {
    const r = this.store.resultats; if (!r) return;
    const annees = r.ca.totalAnnuel.map((v, i) => `<th>Année ${i + 1}</th>`).join('');
    const valeurs = r.ca.totalAnnuel.map(v => `<td>${this._fmt(v)}</td>`).join('');
    $('#main-content').html(`
      <div class="grid-4">
        <div class="kpi positive"><div class="label">CA Année 1</div><div class="value">${this._fmt(r.ca.totalAnnuel[0])}</div></div>
        <div class="kpi"><div class="label">CA Total période</div><div class="value">${this._fmt(_.sum(r.ca.totalAnnuel))}</div></div>
        <div class="kpi"><div class="label">CA moy./mois</div><div class="value">${this._fmt(_.mean(r.ca.totalMensuel))}</div></div>
        <div class="kpi"><div class="label">Nb produits</div><div class="value">${this.store.projet.produits.length}</div></div>
      </div>
      <div class="card"><h3>CA annuel</h3><table class="fin-table"><thead><tr><th>Indicateur</th>${annees}</tr></thead>
      <tbody><tr class="total"><td>Chiffre d'affaires HT</td>${valeurs}</tr></tbody></table></div>
      <div class="card"><h3>Évolution mensuelle du CA</h3><canvas id="chart-ca" class="chart-canvas"></canvas></div>
    `);
    ChartRenderer.drawLineChart(document.getElementById('chart-ca'), r.ca.totalMensuel, r.periodes.map(p => `M${p.index + 1}`));
  }

  // Renders the Subcontracting (Sous-traitance) view
  _renderSoustraitance() {
    const list = this.store.projet.sousTraitance || [];
    const rows = list.map(s => `
    <tr data-id="${s.id}">
      <td><input class="edit" data-f="fournisseur" value="${s.fournisseur}"></td>
      <td><input class="edit" type="number" data-f="montantMensuel" value="${s.montantMensuel}"></td>
      <td><input class="edit" type="number" data-f="tauxTVA" value="${s.tauxTVA}"></td>
      <td><input class="edit" type="number" data-f="indexation" value="${s.indexation}"></td>
      <td><input class="edit" type="number" data-f="moisDemarrage" value="${s.moisDemarrage}"></td>
      <td><button class="btn-danger btn-del">🗑</button></td>
    </tr>`).join('');

    $('#main-content').html(`
    <div class="card">
      <h3>Sous-traitance <button id="btn-add" class="btn-primary" style="float:right">+ Ajouter</button></h3>
      <table class="fin-table">
        <thead>
          <tr>
            <th>Fournisseur</th>
            <th>Montant/mois</th>
            <th>TVA %</th>
            <th>Indexation %</th>
            <th>Mois démarrage</th>
            <th></th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`);

    $('#btn-add').on('click', () => {
      if (!this.store.projet.sousTraitance) this.store.projet.sousTraitance = [];
      this.store.projet.sousTraitance.push(new SousTraitance({}));
      this.store.bus.emit('data:changed');
    });

    this._bindCrud(this.store.projet, 'sousTraitance');
  }

  _renderChargesFixes() {
    const list = this.store.projet.chargesFixes;
    const rows = list.map(c => `
      <tr data-id="${c.id}">
        <td><select class="edit" data-f="categorie">${CATEGORIES_CHARGES_FIXES.map(cat => `<option ${cat === c.categorie ? 'selected' : ''}>${cat}</option>`).join('')}</select></td>
        <td><input class="edit" data-f="nom" value="${c.nom}"></td>
        <td><input class="edit" type="number" data-f="montantMensuel" value="${c.montantMensuel}"></td>
        <td><input class="edit" type="number" data-f="indexation" value="${c.indexation}"></td>
        <td><button class="btn-danger btn-del">🗑</button></td>
      </tr>`).join('');
    $('#main-content').html(`
      <div class="card"><h3>Charges fixes <button id="btn-add" class="btn-primary" style="float:right">+ Ajouter</button></h3>
      <table class="fin-table"><thead><tr><th>Catégorie</th><th>Libellé</th><th>Montant/mois</th><th>Indexation %</th><th></th></tr></thead>
      <tbody>${rows}</tbody></table></div>`);
    $('#btn-add').on('click', () => { this.store.projet.chargesFixes.push(new ChargeFixe({})); this.store.bus.emit('data:changed'); });
    this._bindCrud(this.store.projet, 'chargesFixes');
  }

  _renderChargesVariables() {
    const list = this.store.projet.chargesVariables;
    const rows = list.map(c => `
      <tr data-id="${c.id}">
        <td><input class="edit" data-f="nom" value="${c.nom}"></td>
        <td><select class="edit" data-f="typeCalcul">${['montant', 'pourcentageCA', 'pourcentageProduit'].map(t => `<option ${t === c.typeCalcul ? 'selected' : ''}>${t}</option>`).join('')}</select></td>
        <td><input class="edit" type="number" data-f="valeur" value="${c.valeur}"></td>
        <td><button class="btn-danger btn-del">🗑</button></td>
      </tr>`).join('');
    $('#main-content').html(`<div class="card"><h3>Charges variables <button id="btn-add" class="btn-primary" style="float:right">+ Ajouter</button></h3>
      <table class="fin-table"><thead><tr><th>Libellé</th><th>Type</th><th>Valeur</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>`);
    $('#btn-add').on('click', () => { this.store.projet.chargesVariables.push(new ChargeVariable({})); this.store.bus.emit('data:changed'); });
    this._bindCrud(this.store.projet, 'chargesVariables');
  }

  _renderPersonnel() {
    const list = this.store.projet.personnel;
    const rows = list.map(s => `
      <tr data-id="${s.id}">
        <td><input class="edit" data-f="nom" value="${s.nom}"></td>
        <td><input class="edit" data-f="fonction" value="${s.fonction}"></td>
        <td><input class="edit" type="date" data-f="dateArrivee" value="${s.dateArrivee || ''}"></td>
        <td><input class="edit" type="number" step="0.1" data-f="tempsTravail" value="${s.tempsTravail}"></td>
        <td><input class="edit" type="number" data-f="salaireBrutMensuel" value="${s.salaireBrutMensuel}"></td>
        <td><input class="edit" type="number" data-f="tauxChargesPatronales" value="${s.tauxChargesPatronales}"></td>
        <td>${this._fmt(s.coutMensuel(this.store.projet.entreprise.dateDebutActivite).total * 12)}</td>
        <td><button class="btn-danger btn-del">🗑</button></td>
      </tr>`).join('');
    $('#main-content').html(`<div class="card"><h3>Personnel <button id="btn-add" class="btn-primary" style="float:right">+ Ajouter</button></h3>
      <table class="fin-table"><thead><tr><th>Nom</th><th>Fonction</th><th>Arrivée</th><th>ETP</th><th>Brut/mois</th><th>Charges %</th><th>Coût an. estimé</th><th></th></tr></thead>
      <tbody>${rows}</tbody></table></div>`);
    $('#btn-add').on('click', () => { this.store.projet.personnel.push(new Salarie({})); this.store.bus.emit('data:changed'); });
    this._bindCrud(this.store.projet, 'personnel');
  }

  _renderInvestissements() {
    const list = this.store.projet.investissements;
    const rows = list.map(i => `
      <tr data-id="${i.id}">
        <td><input class="edit" data-f="nom" value="${i.nom}"></td>
        <td><select class="edit" data-f="categorie">${['corporel', 'incorporel', 'financier'].map(c => `<option ${c === i.categorie ? 'selected' : ''}>${c}</option>`).join('')}</select></td>
        <td><input class="edit" type="number" data-f="montantHT" value="${i.montantHT}"></td>
        <td><input class="edit" type="number" data-f="dureeAns" value="${i.dureeAns}"></td>
        <td><select class="edit" data-f="mode">${['lineaire', 'degressif'].map(m => `<option ${m === i.mode ? 'selected' : ''}>${m}</option>`).join('')}</select></td>
        <td><input class="edit" type="date" data-f="dateAcquisition" value="${i.dateAcquisition}"></td>
        <td><button class="btn-danger btn-del">🗑</button></td>
      </tr>`).join('');
    $('#main-content').html(`<div class="card"><h3>Investissements <button id="btn-add" class="btn-primary" style="float:right">+ Ajouter</button></h3>
      <table class="fin-table"><thead><tr><th>Nom</th><th>Catégorie</th><th>Montant HT</th><th>Durée</th><th>Mode</th><th>Date</th><th></th></tr></thead>
      <tbody>${rows}</tbody></table></div>`);
    $('#btn-add').on('click', () => { this.store.projet.investissements.push(new Investissement({})); this.store.bus.emit('data:changed'); });
    this._bindCrud(this.store.projet, 'investissements');
  }

  _renderEmprunts() {
    const list = this.store.projet.emprunts;
    const rows = list.map(e => `
      <tr data-id="${e.id}">
        <td><input class="edit" data-f="nom" value="${e.nom}"></td>
        <td><input class="edit" type="number" data-f="capital" value="${e.capital}"></td>
        <td><input class="edit" type="number" step="0.1" data-f="tauxAnnuel" value="${e.tauxAnnuel}"></td>
        <td><input class="edit" type="number" data-f="dureeMois" value="${e.dureeMois}"></td>
        <td><input class="edit" type="number" data-f="differeMois" value="${e.differeMois}"></td>
        <td><button class="btn-danger btn-del">🗑</button></td>
      </tr>`).join('');
    $('#main-content').html(`<div class="card"><h3>Emprunts <button id="btn-add" class="btn-primary" style="float:right">+ Ajouter</button></h3>
      <table class="fin-table"><thead><tr><th>Nom</th><th>Capital</th><th>Taux %</th><th>Durée (mois)</th><th>Différé</th><th></th></tr></thead>
      <tbody>${rows}</tbody></table></div>`);
    $('#btn-add').on('click', () => { this.store.projet.emprunts.push(new Emprunt({})); this.store.bus.emit('data:changed'); });
    this._bindCrud(this.store.projet, 'emprunts');
  }

  _renderApports() {
    const list = this.store.projet.apports;
    const rows = list.map(a => `
      <tr data-id="${a.id}">
        <td><select class="edit" data-f="type">${['capital', 'ccaAssocie', 'subvention', 'loveMoney', 'leveeFonds', 'crowdfunding'].map(t => `<option ${t === a.type ? 'selected' : ''}>${t}</option>`).join('')}</select></td>
        <td><input class="edit" data-f="libelle" value="${a.libelle}"></td>
        <td><input class="edit" type="number" data-f="montant" value="${a.montant}"></td>
        <td><input class="edit" type="number" data-f="moisIndex" value="${a.moisIndex}"></td>
        <td><button class="btn-danger btn-del">🗑</button></td>
      </tr>`).join('');
    $('#main-content').html(`<div class="card"><h3>Apports <button id="btn-add" class="btn-primary" style="float:right">+ Ajouter</button></h3>
      <table class="fin-table"><thead><tr><th>Type</th><th>Libellé</th><th>Montant</th><th>Mois</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>`);
    $('#btn-add').on('click', () => { this.store.projet.apports.push(new Apport({})); this.store.bus.emit('data:changed'); });
    this._bindCrud(this.store.projet, 'apports');
  }
  // ---------------------------------------------------------
  // MODULE : BESOIN EN FONDS DE ROULEMENT
  // ---------------------------------------------------------
  _renderBFR() {
    const bfrParams = this.store.projet.bfr;
    const r = this.store.resultats;

    const dernierIdx = r ? r.bfr.bfrMensuel.length - 1 : 0;
    const bfrActuel = r ? r.bfr.bfrMensuel[dernierIdx] : 0;

    // Synthèse annuelle : on prend le dernier mois de chaque année (ou le dernier mois du projet)
    const rowsAnnuel = r
      ? r.periodes
        .filter(p => p.moisDansAnnee === 12 || p.index === r.periodes.length - 1)
        .map(p => `
          <tr>
            <td>Année ${p.annee}</td>
            <td>${this._fmt(r.bfr.creancesClients[p.index])}</td>
            <td>${this._fmt(r.bfr.stocks[p.index])}</td>
            <td>${this._fmt(r.bfr.dettesFournisseurs[p.index])}</td>
            <td class="total">${this._fmt(r.bfr.bfrMensuel[p.index])}</td>
          </tr>`).join('')
      : '';

    $('#main-content').html(`
    <div class="card">
      <h3>Paramètres du Besoin en Fonds de Roulement</h3>
      <div class="grid-4">
        <div>
          <label>Délai de paiement clients (jours)</label>
          <input type="number" id="bfr-delai-client" value="${bfrParams.delaiClientJours}">
        </div>
        <div>
          <label>Délai de paiement fournisseurs (jours)</label>
          <input type="number" id="bfr-delai-fournisseur" value="${bfrParams.delaiFournisseurJours}">
        </div>
        <div>
          <label>Rotation des stocks (jours)</label>
          <input type="number" id="bfr-delai-stock" value="${bfrParams.delaiStockJours}">
        </div>
        <div>
          <label>Stock moyen (% du CA)</label>
          <input type="number" id="bfr-taux-stock" value="${bfrParams.tauxStockSurCA}">
        </div>
      </div>
      <p style="font-size:12px;color:var(--text-muted);margin-top:8px;">
        💡 Si un délai de rotation des stocks (en jours) est renseigné, il prévaut sur le taux forfaitaire.
        Formule : <strong>BFR = Créances clients + Stocks − Dettes fournisseurs</strong>.
      </p>
    </div>

    <div class="grid-4">
      <div class="kpi ${bfrActuel > 0 ? 'negative' : 'positive'}">
        <div class="label">BFR actuel (dernier mois)</div>
        <div class="value">${this._fmt(bfrActuel)}</div>
      </div>
      <div class="kpi"><div class="label">Créances clients</div><div class="value">${this._fmt(r ? r.bfr.creancesClients[dernierIdx] : 0)}</div></div>
      <div class="kpi"><div class="label">Dettes fournisseurs</div><div class="value">${this._fmt(r ? r.bfr.dettesFournisseurs[dernierIdx] : 0)}</div></div>
      <div class="kpi"><div class="label">Stocks</div><div class="value">${this._fmt(r ? r.bfr.stocks[dernierIdx] : 0)}</div></div>
    </div>

    <div class="card">
      <h3>Évolution mensuelle du BFR</h3>
      <canvas id="chart-bfr" class="chart-canvas"></canvas>
    </div>

    <div class="card">
      <h3>Synthèse annuelle du BFR</h3>
      <table class="fin-table">
        <thead><tr><th>Période</th><th>Créances clients</th><th>Stocks</th><th>Dettes fournisseurs</th><th>BFR</th></tr></thead>
        <tbody>${rowsAnnuel}</tbody>
      </table>
    </div>
  `);

    if (r) {
      ChartRenderer.drawLineChart(
        document.getElementById('chart-bfr'),
        r.bfr.bfrMensuel,
        r.periodes.map(p => `M${p.index + 1}`)
      );
    }

    // Un seul objet de paramètres (pas de CRUD liste) → binding direct des 4 champs
    $('#bfr-delai-client, #bfr-delai-fournisseur, #bfr-delai-stock, #bfr-taux-stock').on('change', () => {
      bfrParams.delaiClientJours = +$('#bfr-delai-client').val();
      bfrParams.delaiFournisseurJours = +$('#bfr-delai-fournisseur').val();
      bfrParams.delaiStockJours = +$('#bfr-delai-stock').val();
      bfrParams.tauxStockSurCA = +$('#bfr-taux-stock').val();
      this.store.bus.emit('data:changed');
    });
  }

  /** Binding générique CRUD (édition + suppression) réutilisé par tous les modules liste */
  _bindCrud(projet, collectionName) {
    $('.edit').off('change').on('change', (e) => {
      const id = $(e.currentTarget).closest('tr').data('id');
      const item = projet[collectionName].find(x => x.id === id);
      const field = $(e.currentTarget).data('f');
      item[field] = e.currentTarget.type === 'number' ? +e.currentTarget.value : e.currentTarget.value;
      this.store.bus.emit('data:changed');
    });
    $('.btn-del').off('click').on('click', (e) => {
      const id = $(e.currentTarget).closest('tr').data('id');
      projet[collectionName] = projet[collectionName].filter(x => x.id !== id);
      this.store.bus.emit('data:changed');
    });
  }

  // ---------------------------------------------------------
  // ÉTATS FINANCIERS
  // ---------------------------------------------------------
  _renderCompteResultat() {
    const r = this.store.resultats; if (!r) return;
    const annees = r.compteResultat.parAnnee.map(l => `<th>Année ${l.annee}</th>`).join('');
    const ligne = (label, key, cssClass = '') => `<tr class="${cssClass}"><td>${label}</td>${r.compteResultat.parAnnee.map(l => `<td>${this._fmt(l[key])}</td>`).join('')}</tr>`;
    $('#main-content').html(`
      <div class="card"><h3>Compte de résultat — Soldes Intermédiaires de Gestion</h3>
      <table class="fin-table"><thead><tr><th>Poste</th>${annees}</tr></thead><tbody>
        ${ligne('Chiffre d\'affaires (Production)', 'production', 'total')}
        ${ligne('Consommations en provenance de tiers', 'consommationsExternes')}
        ${ligne('Valeur Ajoutée', 'valeurAjoutee', 'sig')}
        ${ligne('Impôts et taxes (CFE/CVAE)', 'impotsEtTaxes')}
        ${ligne('Charges de personnel', 'chargesPersonnel')}
        ${ligne('Excédent Brut d\'Exploitation (EBE)', 'ebe', 'sig')}
        ${ligne('Dotations aux amortissements', 'dotationsAmortissements')}
        ${ligne('Résultat d\'exploitation', 'resultatExploitation', 'sig')}
        ${ligne('Charges financières (intérêts)', 'chargesFinancieres')}
        ${ligne('Résultat courant avant impôt', 'resultatCourantAvantImpot', 'sig')}
        ${ligne('Impôt sur les sociétés', 'is')}
        ${ligne('Résultat net', 'resultatNet', 'total')}
        ${ligne('Capacité d\'autofinancement (CAF)', 'caf', 'total')}
      </tbody></table></div>`);
  }

  _renderBilan() {
    const r = this.store.resultats; if (!r) return;
    const annees = r.bilan.parAnnee.map(l => `<th>Année ${l.annee}</th>`).join('');
    $('#main-content').html(`
      <div class="card"><h3>Bilan — ACTIF</h3>
      <table class="fin-table"><thead><tr><th>Poste</th>${annees}</tr></thead><tbody>
        <tr><td>Immobilisations nettes</td>${r.bilan.parAnnee.map(b => `<td>${this._fmt(b.actif.immobilisationsNettes)}</td>`).join('')}</tr>
        <tr><td>Créances clients</td>${r.bilan.parAnnee.map(b => `<td>${this._fmt(b.actif.creancesClients)}</td>`).join('')}</tr>
        <tr><td>Stocks</td>${r.bilan.parAnnee.map(b => `<td>${this._fmt(b.actif.stocks)}</td>`).join('')}</tr>
        <tr><td>Disponibilités</td>${r.bilan.parAnnee.map(b => `<td>${this._fmt(b.actif.disponibilites)}</td>`).join('')}</tr>
        <tr class="total"><td>TOTAL ACTIF</td>${r.bilan.parAnnee.map(b => `<td>${this._fmt(b.actif.total)}</td>`).join('')}</tr>
      </tbody></table></div>
      <div class="card"><h3>Bilan — PASSIF</h3>
      <table class="fin-table"><thead><tr><th>Poste</th>${annees}</tr></thead><tbody>
        <tr><td>Capitaux propres</td>${r.bilan.parAnnee.map(b => `<td>${this._fmt(b.passif.capitauxPropres)}</td>`).join('')}</tr>
        <tr><td>Dettes financières</td>${r.bilan.parAnnee.map(b => `<td>${this._fmt(b.passif.dettesFinancieresLT)}</td>`).join('')}</tr>
        <tr><td>Dettes fournisseurs</td>${r.bilan.parAnnee.map(b => `<td>${this._fmt(b.passif.dettesFournisseurs)}</td>`).join('')}</tr>
        <tr class="total"><td>TOTAL PASSIF</td>${r.bilan.parAnnee.map(b => `<td>${this._fmt(b.passif.total)}</td>`).join('')}</tr>
        <tr><td>Équilibre</td>${r.bilan.parAnnee.map(b => `<td>${b.equilibre ? '✅' : '❌'}</td>`).join('')}</tr>
      </tbody></table></div>`);
  }

  _renderTresorerie() {
    const r = this.store.resultats; if (!r) return;
    const rows = r.tresorerie.detail.map(m => `
      <tr class="${m.alerte ? 'total' : ''}" style="${m.alerte ? 'color:var(--danger)' : ''}">
        <td>A${m.annee} - M${m.moisDansAnnee}</td>
        <td>${this._fmt(m.encaissements)}</td>
        <td>${this._fmt(m.decaissements)}</td>
        <td>${this._fmt(m.soldeMensuel)}</td>
        <td>${this._fmt(m.soldeCumule)}</td>
      </tr>`).join('');
    $('#main-content').html(`
      <div class="card"><h3>Trésorerie mensuelle</h3><canvas id="chart-tresorerie" class="chart-canvas"></canvas></div>
      <div class="card"><h3>Détail</h3><div style="max-height:500px;overflow:auto;">
      <table class="fin-table"><thead><tr><th>Période</th><th>Encaissements</th><th>Décaissements</th><th>Solde mensuel</th><th>Solde cumulé</th></tr></thead>
      <tbody>${rows}</tbody></table></div></div>`);
    ChartRenderer.drawLineChart(document.getElementById('chart-tresorerie'), r.tresorerie.detail.map(m => m.soldeCumule), r.periodes.map(p => `M${p.index + 1}`));
  }

  _renderPlanFinancement() {
    const r = this.store.resultats; if (!r) return;
    const annees = r.planFinancement.parAnnee.map(l => `<th>Année ${l.annee}</th>`).join('');
    $('#main-content').html(`
      <div class="card"><h3>Plan de financement — EMPLOIS</h3>
      <table class="fin-table"><thead><tr><th>Poste</th>${annees}</tr></thead><tbody>
        <tr><td>Investissements</td>${r.planFinancement.parAnnee.map(l => `<td>${this._fmt(l.emplois.investissements)}</td>`).join('')}</tr>
        <tr><td>Variation BFR</td>${r.planFinancement.parAnnee.map(l => `<td>${this._fmt(l.emplois.variationBFR)}</td>`).join('')}</tr>
        <tr><td>Remboursement capital</td>${r.planFinancement.parAnnee.map(l => `<td>${this._fmt(l.emplois.remboursementCapital)}</td>`).join('')}</tr>
        <tr class="total"><td>Total emplois</td>${r.planFinancement.parAnnee.map(l => `<td>${this._fmt(l.totalEmplois)}</td>`).join('')}</tr>
      </tbody></table></div>
      <div class="card"><h3>Plan de financement — RESSOURCES</h3>
      <table class="fin-table"><thead><tr><th>Poste</th>${annees}</tr></thead><tbody>
        <tr><td>CAF</td>${r.planFinancement.parAnnee.map(l => `<td>${this._fmt(l.ressources.caf)}</td>`).join('')}</tr>
        <tr><td>Apports</td>${r.planFinancement.parAnnee.map(l => `<td>${this._fmt(l.ressources.apports)}</td>`).join('')}</tr>
        <tr><td>Nouveaux emprunts</td>${r.planFinancement.parAnnee.map(l => `<td>${this._fmt(l.ressources.nouveauxEmprunts)}</td>`).join('')}</tr>
        <tr class="total"><td>Total ressources</td>${r.planFinancement.parAnnee.map(l => `<td>${this._fmt(l.totalRessources)}</td>`).join('')}</tr>
        <tr><td>Solde net</td>${r.planFinancement.parAnnee.map(l => `<td>${this._fmt(l.solde)}</td>`).join('')}</tr>
      </tbody></table></div>`);
  }

  _renderRatios() {
    const r = this.store.resultats; if (!r) return;
    const annees = r.ratios.parAnnee.map(l => `<th>Année ${l.annee}</th>`).join('');
    $('#main-content').html(`
      <div class="card"><h3>Ratios financiers</h3>
      <table class="fin-table"><thead><tr><th>Indicateur</th>${annees}</tr></thead><tbody>
        <tr><td>CAF</td>${r.ratios.parAnnee.map(l => `<td>${this._fmt(l.caf)}</td>`).join('')}</tr>
        <tr><td>BFR</td>${r.ratios.parAnnee.map(l => `<td>${this._fmt(l.bfr)}</td>`).join('')}</tr>
        <tr><td>FRNG</td>${r.ratios.parAnnee.map(l => `<td>${this._fmt(l.frng)}</td>`).join('')}</tr>
        <tr><td>Trésorerie nette</td>${r.ratios.parAnnee.map(l => `<td>${this._fmt(l.tresorerieNette)}</td>`).join('')}</tr>
        <tr><td>EBE</td>${r.ratios.parAnnee.map(l => `<td>${this._fmt(l.ebe)}</td>`).join('')}</tr>
        <tr><td>Marge commerciale</td>${r.ratios.parAnnee.map(l => `<td>${this._fmtPct(l.margeCommerciale)}</td>`).join('')}</tr>
        <tr><td>Rentabilité nette</td>${r.ratios.parAnnee.map(l => `<td>${this._fmtPct(l.rentabiliteNette)}</td>`).join('')}</tr>
        <tr><td>ROI</td>${r.ratios.parAnnee.map(l => `<td>${l.roi !== null ? this._fmtPct(l.roi) : '-'}</td>`).join('')}</tr>
        <tr><td>ROE</td>${r.ratios.parAnnee.map(l => `<td>${l.roe !== null ? this._fmtPct(l.roe) : '-'}</td>`).join('')}</tr>
        <tr><td>Seuil de rentabilité</td>${r.ratios.parAnnee.map(l => `<td>${l.seuilRentabilite ? this._fmt(l.seuilRentabilite) : '-'}</td>`).join('')}</tr>
        <tr><td>DSCR</td>${r.ratios.parAnnee.map(l => `<td>${l.dscr !== null ? l.dscr.toFixed(2) : '-'}</td>`).join('')}</tr>
        <tr><td>Capacité de remboursement (ans)</td>${r.ratios.parAnnee.map(l => `<td>${l.capaciteRemboursement !== null ? l.capaciteRemboursement.toFixed(1) : '-'}</td>`).join('')}</tr>
      </tbody></table></div>`);
  }

  _renderGraphiques() {
    const r = this.store.resultats; if (!r) return;
    $('#main-content').html(`
      <div class="grid-3">
        <div class="card"><h3>Évolution du CA</h3><canvas id="g1" class="chart-canvas"></canvas></div>
        <div class="card"><h3>Évolution EBE / Résultat net</h3><canvas id="g2" class="chart-canvas"></canvas></div>
        <div class="card"><h3>Trésorerie cumulée</h3><canvas id="g3" class="chart-canvas"></canvas></div>
        <div class="card"><h3>Répartition des charges</h3><canvas id="g4" class="chart-canvas"></canvas></div>
        <div class="card"><h3>BFR annuel</h3><canvas id="g5" class="chart-canvas"></canvas></div>
        <div class="card"><h3>Capitaux propres</h3><canvas id="g6" class="chart-canvas"></canvas></div>
      </div>`);
    ChartRenderer.drawBarChart(document.getElementById('g1'), r.ca.totalAnnuel, r.ca.totalAnnuel.map((_, i) => `An.${i + 1}`));
    ChartRenderer.drawLineChart(document.getElementById('g2'), r.compteResultat.parAnnee.map(l => l.resultatNet), r.compteResultat.parAnnee.map(l => `An.${l.annee}`));
    ChartRenderer.drawLineChart(document.getElementById('g3'), r.tresorerie.detail.map(m => m.soldeCumule), r.periodes.map(p => `M${p.index + 1}`));
    ChartRenderer.drawPieChart(document.getElementById('g4'), [
      { label: 'Charges fixes', value: _.sum(r.chargesFixes.totalAnnuel) },
      { label: 'Charges variables', value: _.sum(r.achats.totalAnnuel) },
      { label: 'Personnel', value: _.sum(r.personnel.totalAnnuel) }
    ]);
    ChartRenderer.drawBarChart(document.getElementById('g5'), r.ratios.parAnnee.map(l => l.bfr), r.ratios.parAnnee.map(l => `An.${l.annee}`));
    ChartRenderer.drawBarChart(document.getElementById('g6'), r.bilan.parAnnee.map(b => b.passif.capitauxPropres), r.bilan.parAnnee.map(b => `An.${b.annee}`));
  }

  afficherAlertes(erreurs) {
    if (!erreurs.length) { $('#alert-bar').addClass('hidden'); return; }
    const msg = erreurs.map(e => `<strong>[${e.module}]</strong> ${e.message}`).join(' &nbsp;•&nbsp; ');
    $('#alert-bar').removeClass('hidden').html(`⚠️ ${msg}`);
  }
}

// ============================================================
// MOTEUR DE GRAPHIQUES CANVAS NATIF (aucune librairie de charts)
// ============================================================
export class ChartRenderer {
  static _setupCanvas(canvas) {
    const ctx = canvas.getContext('2d');
    const ratio = window.devicePixelRatio || 1;
    canvas.width = canvas.clientWidth * ratio;
    canvas.height = canvas.clientHeight * ratio;
    ctx.scale(ratio, ratio);
    ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);
    return { ctx, w: canvas.clientWidth, h: canvas.clientHeight };
  }

  static drawLineChart(canvas, data, labels) {
    const { ctx, w, h } = this._setupCanvas(canvas);
    const padding = 40;
    const max = Math.max(...data, 1), min = Math.min(...data, 0);
    const range = max - min || 1;
    const stepX = (w - padding * 2) / (data.length - 1 || 1);

    ctx.strokeStyle = '#e6e8ef'; ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = padding + (h - padding * 2) * (i / 4);
      ctx.beginPath(); ctx.moveTo(padding, y); ctx.lineTo(w - padding, y); ctx.stroke();
    }
    ctx.strokeStyle = '#4f46e5'; ctx.lineWidth = 2; ctx.beginPath();
    data.forEach((v, i) => {
      const x = padding + i * stepX;
      const y = padding + (h - padding * 2) * (1 - (v - min) / range);
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.stroke();
    ctx.fillStyle = 'rgba(79,70,229,.08)';
    ctx.lineTo(w - padding, h - padding); ctx.lineTo(padding, h - padding); ctx.closePath(); ctx.fill();
  }

  static drawBarChart(canvas, data, labels) {
    const { ctx, w, h } = this._setupCanvas(canvas);
    const padding = 40;
    const max = Math.max(...data, 1);
    const barW = (w - padding * 2) / data.length * 0.6;
    const gap = (w - padding * 2) / data.length;
    data.forEach((v, i) => {
      const barH = (h - padding * 2) * (v / max);
      const x = padding + i * gap + gap * 0.2;
      const y = h - padding - barH;
      ctx.fillStyle = '#4f46e5';
      ctx.fillRect(x, y, barW, barH);
      ctx.fillStyle = '#6b7280'; ctx.font = '10px Inter'; ctx.textAlign = 'center';
      ctx.fillText(labels[i] || '', x + barW / 2, h - padding + 14);
    });
  }

  static drawPieChart(canvas, dataArr) {
    const { ctx, w, h } = this._setupCanvas(canvas);
    const total = _.sumBy(dataArr, 'value') || 1;
    const cx = w / 2, cy = h / 2, radius = Math.min(w, h) / 2 - 30;
    const colors = ['#4f46e5', '#16a34a', '#d97706', '#dc2626', '#0891b2'];
    let angleStart = -Math.PI / 2;
    dataArr.forEach((d, i) => {
      const angle = (d.value / total) * Math.PI * 2;
      ctx.beginPath(); ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, radius, angleStart, angleStart + angle);
      ctx.closePath(); ctx.fillStyle = colors[i % colors.length]; ctx.fill();
      angleStart += angle;
    });
    // Légende
    dataArr.forEach((d, i) => {
      ctx.fillStyle = colors[i % colors.length];
      ctx.fillRect(10, 10 + i * 18, 10, 10);
      ctx.fillStyle = '#6b7280'; ctx.font = '11px Inter'; ctx.textAlign = 'left';
      ctx.fillText(`${d.label} (${Math.round(d.value / total * 100)}%)`, 26, 19 + i * 18);
    });
  }
}