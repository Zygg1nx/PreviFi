// ============================================================
// EXPORTPDF.JS — Génération du dossier PDF professionnel
// ============================================================
export class PDFExporter {
  constructor(projet, resultats) { this.projet = projet; this.resultats = resultats; }

  generer() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    this._pageDeGarde(doc);
    doc.addPage(); this._sommaire(doc);
    doc.addPage(); this._sectionCA(doc);
    doc.addPage(); this._sectionCompteResultat(doc);
    doc.addPage(); this._sectionBilan(doc);
    doc.addPage(); this._sectionTresorerie(doc);
    doc.addPage(); this._sectionRatiosEtCommentaires(doc);
    this._paginationGlobale(doc);
    doc.save(`${this._sanitizeText(this.projet.entreprise.nom).replace(/\s+/g,'_')}_previsionnel.pdf`);
  }

  _pageDeGarde(doc) {
    doc.setFillColor(79, 70, 229); doc.rect(0, 0, 595, 250, 'F');
    doc.setTextColor(255, 255, 255); doc.setFontSize(28);
    this._texte(doc, 'Prévisionnel Financier', 40, 130);
    doc.setFontSize(16); this._texte(doc, this.projet.entreprise.nom, 40, 165);
    doc.setFontSize(11); this._texte(doc, `Forme juridique : ${this.projet.entreprise.formeJuridique}`, 40, 300);
    this._texte(doc, `Durée : ${this.projet.entreprise.nbAnnees} an(s)`, 40, 320);
    this._texte(doc, `Date de génération : ${new Date().toLocaleDateString('fr-FR')}`, 40, 340);
    doc.setTextColor(0,0,0);
  }

  _sommaire(doc) {
    doc.setFontSize(18); this._texte(doc, 'Sommaire', 40, 50);
    const items = ['1. Chiffre d\'affaires', '2. Compte de résultat & SIG', '3. Bilan prévisionnel', '4. Plan de trésorerie', '5. Ratios & analyse financière'];
    doc.setFontSize(12);
    items.forEach((it, i) => this._texte(doc, it, 40, 90 + i * 24));
  }

  _sectionCA(doc) {
    doc.setFontSize(16); this._texte(doc, '1. Chiffre d\'affaires prévisionnel', 40, 50);
    doc.autoTable({
      startY: 70,
      head: [this._sanitizeRow(['Indicateur', ...this.resultats.ca.totalAnnuel.map((_,i)=>`Année ${i+1}`)])],
      body: [this._sanitizeRow(['CA HT', ...this.resultats.ca.totalAnnuel.map(v => this._f(v))])],
      theme: 'grid', headStyles: { fillColor: [79,70,229] }
    });
  }

  _sectionCompteResultat(doc) {
    doc.setFontSize(16); this._texte(doc, '2. Compte de résultat — SIG', 40, 50);
    const lignesLabel = [
      ['production','Chiffre d\'affaires'], ['valeurAjoutee','Valeur Ajoutée'],
      ['ebe','EBE'], ['resultatExploitation','Résultat d\'exploitation'],
      ['resultatNet','Résultat net'], ['caf','CAF']
    ];
    doc.autoTable({
      startY: 70,
      head: [this._sanitizeRow(['Poste', ...this.resultats.compteResultat.parAnnee.map(l=>`Année ${l.annee}`)])],
      body: lignesLabel.map(([key,label]) => this._sanitizeRow([label, ...this.resultats.compteResultat.parAnnee.map(l => this._f(l[key]))])),
      theme: 'grid', headStyles: { fillColor: [79,70,229] }
    });
  }

  _sectionBilan(doc) {
    doc.setFontSize(16); this._texte(doc, '3. Bilan prévisionnel', 40, 50);
    doc.autoTable({
      startY: 70,
      head: [this._sanitizeRow(['ACTIF', ...this.resultats.bilan.parAnnee.map(b=>`Année ${b.annee}`)])],
      body: [
        this._sanitizeRow(['Immobilisations nettes', ...this.resultats.bilan.parAnnee.map(b=>this._f(b.actif.immobilisationsNettes))]),
        this._sanitizeRow(['Créances clients', ...this.resultats.bilan.parAnnee.map(b=>this._f(b.actif.creancesClients))]),
        this._sanitizeRow(['Disponibilités', ...this.resultats.bilan.parAnnee.map(b=>this._f(b.actif.disponibilites))]),
        this._sanitizeRow(['TOTAL ACTIF', ...this.resultats.bilan.parAnnee.map(b=>this._f(b.actif.total))])
      ],
      theme: 'grid', headStyles: { fillColor: [79,70,229] }
    });
    doc.autoTable({
      startY: doc.lastAutoTable.finalY + 20,
      head: [this._sanitizeRow(['PASSIF', ...this.resultats.bilan.parAnnee.map(b=>`Année ${b.annee}`)])],
      body: [
        this._sanitizeRow(['Capitaux propres', ...this.resultats.bilan.parAnnee.map(b=>this._f(b.passif.capitauxPropres))]),
        this._sanitizeRow(['Dettes financières', ...this.resultats.bilan.parAnnee.map(b=>this._f(b.passif.dettesFinancieresLT))]),
        this._sanitizeRow(['TOTAL PASSIF', ...this.resultats.bilan.parAnnee.map(b=>this._f(b.passif.total))])
      ],
      theme: 'grid', headStyles: { fillColor: [79,70,229] }
    });
  }

  _sectionTresorerie(doc) {
    doc.setFontSize(16); this._texte(doc, '4. Plan de trésorerie (synthèse annuelle)', 40, 50);
    const parAnnee = _.groupBy(this.resultats.tresorerie.detail, 'annee');
    const body = Object.entries(parAnnee).map(([an, mois]) => this._sanitizeRow([
      `Année ${an}`, this._f(_.sumBy(mois,'encaissements')), this._f(_.sumBy(mois,'decaissements')), this._f(_.last(mois).soldeCumule)
    ]));
    doc.autoTable({ startY: 70, head: [this._sanitizeRow(['Période','Encaissements','Décaissements','Solde cumulé fin'])], body, theme:'grid', headStyles:{fillColor:[79,70,229]} });
  }

  _sectionRatiosEtCommentaires(doc) {
    doc.setFontSize(16); this._texte(doc, '5. Ratios & analyse financière', 40, 50);
    doc.autoTable({
      startY: 70,
      head: [this._sanitizeRow(['Ratio', ...this.resultats.ratios.parAnnee.map(l=>`Année ${l.annee}`)])],
      body: [
        this._sanitizeRow(['CAF', ...this.resultats.ratios.parAnnee.map(l=>this._f(l.caf))]),
        this._sanitizeRow(['BFR', ...this.resultats.ratios.parAnnee.map(l=>this._f(l.bfr))]),
        this._sanitizeRow(['Trésorerie nette', ...this.resultats.ratios.parAnnee.map(l=>this._f(l.tresorerieNette))]),
        this._sanitizeRow(['Rentabilité nette (%)', ...this.resultats.ratios.parAnnee.map(l=>l.rentabiliteNette.toFixed(1)+'%')]),
      ], theme:'grid', headStyles:{fillColor:[79,70,229]}
    });

    const commentaire = this._genererCommentaire();
    doc.setFontSize(11);
    const lignes = doc.splitTextToSize(this._sanitizeText(commentaire), 500);
    doc.text(lignes, 40, doc.lastAutoTable.finalY + 30);
  }

  _genererCommentaire() {
    const dernier = _.last(this.resultats.ratios.parAnnee);
    const caN1 = this.resultats.ca.totalAnnuel[0];
    const rentabilite = dernier.rentabiliteNette;
    let texte = `Sur la période analysée, le chiffre d'affaires prévisionnel démarre à ${this._f(caN1)} en année 1. `;
    texte += rentabilite > 10
      ? `Le niveau de rentabilité nette (${rentabilite.toFixed(1)}%) témoigne d'un modèle économique solide. `
      : `Le niveau de rentabilité nette (${rentabilite.toFixed(1)}%) reste à consolider, une attention particulière doit être portée à la maîtrise des charges. `;
    const moisNeg = this.resultats.tresorerie.detail.filter(m => m.alerte).length;
    texte += moisNeg > 0
      ? `Le plan de trésorerie fait apparaître ${moisNeg} mois de trésorerie négative : un besoin de financement complémentaire est à anticiper.`
      : `Le plan de trésorerie ne présente aucune impasse sur la période, ce qui traduit un équilibre financier maîtrisé.`;
    return texte;
  }

  _paginationGlobale(doc) {
    const nbPages = doc.internal.getNumberOfPages();
    for (let i = 1; i <= nbPages; i++) {
      doc.setPage(i);
      doc.setFontSize(9); doc.setTextColor(150);
      this._texte(doc, `Page ${i} / ${nbPages} — ${this.projet.entreprise.nom} — Prévisionnel financier`, 40, 820);
    }
  }

  /**
   * GARDE-FOU — Neutralise les caractères Unicode non supportés par les
   * fontes standard de jsPDF (WinAnsiEncoding) avant tout envoi au moteur
   * PDF. Corrige notamment le bug de U+202F (espace fine insécable) inséré
   * par Number.toLocaleString('fr-FR') depuis Chrome/Edge 76+.
   */
  _sanitizeText(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/\u202F/g, ' ')
      .replace(/\u00A0/g, ' ')
      .replace(/\u2009/g, ' ')
      .replace(/\u2011/g, '-');
  }

  /** Wrapper sécurisé autour de doc.text() */
  _texte(doc, texte, x, y, options) {
    doc.text(this._sanitizeText(texte), x, y, options);
  }

  /** Sanitize une ligne complète destinée à autotable */
  _sanitizeRow(row) {
    return row.map(cell => this._sanitizeText(cell));
  }

  /**
   * Formate un montant pour affichage PDF avec un séparateur de milliers
   * ASCII (espace normale), pour éviter tout caractère Unicode incompatible
   * avec les fontes standard de jsPDF.
   */
  _f(n) {
    const valeur = Math.round(n || 0);
    const negatif = valeur < 0;
    const partieEntiere = Math.abs(valeur).toString();
    const avecEspaces = partieEntiere.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    return `${negatif ? '-' : ''}${avecEspaces} €`;
  }
}