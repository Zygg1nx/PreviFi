// ============================================================
// EXPORTEXCEL.JS — Export classeur multi-feuilles via SheetJS
// ============================================================
export class ExcelExporter {
  constructor(projet, resultats) { this.projet = projet; this.resultats = resultats; }

  generer() {
    const wb = XLSX.utils.book_new();
    this._addSheetCA(wb);
    this._addSheetCR(wb);
    this._addSheetBilan(wb);
    this._addSheetTresorerie(wb);
    this._addSheetRatios(wb);
    XLSX.writeFile(wb, `${this.projet.entreprise.nom.replace(/\s+/g,'_')}_previsionnel.xlsx`);
  }

  _addSheetCA(wb) {
    const rows = [['Produit', ...this.resultats.periodes.map(p => `A${p.annee}M${p.moisDansAnnee}`)]];
    this.projet.produits.forEach(p => rows.push([p.nom, ...this.resultats.ca.detailParProduit[p.id]]));
    rows.push(['TOTAL', ...this.resultats.ca.totalMensuel]);
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), 'CA');
  }

  _addSheetCR(wb) {
    const cols = this.resultats.compteResultat.parAnnee.map(l => `Année ${l.annee}`);
    const rows = [
      ['Poste', ...cols],
      ['CA', ...this.resultats.compteResultat.parAnnee.map(l => l.production)],
      ['Valeur Ajoutée', ...this.resultats.compteResultat.parAnnee.map(l => l.valeurAjoutee)],
      ['EBE', ...this.resultats.compteResultat.parAnnee.map(l => l.ebe)],
      ['Résultat exploitation', ...this.resultats.compteResultat.parAnnee.map(l => l.resultatExploitation)],
      ['Résultat net', ...this.resultats.compteResultat.parAnnee.map(l => l.resultatNet)],
      ['CAF', ...this.resultats.compteResultat.parAnnee.map(l => l.caf)],
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), 'Compte de résultat');
  }

  _addSheetBilan(wb) {
    const cols = this.resultats.bilan.parAnnee.map(b => `Année ${b.annee}`);
    const rows = [
      ['ACTIF', ...cols],
      ['Immobilisations nettes', ...this.resultats.bilan.parAnnee.map(b => b.actif.immobilisationsNettes)],
      ['Créances clients', ...this.resultats.bilan.parAnnee.map(b => b.actif.creancesClients)],
      ['Disponibilités', ...this.resultats.bilan.parAnnee.map(b => b.actif.disponibilites)],
      ['TOTAL ACTIF', ...this.resultats.bilan.parAnnee.map(b => b.actif.total)],
      [],
      ['PASSIF', ...cols],
      ['Capitaux propres', ...this.resultats.bilan.parAnnee.map(b => b.passif.capitauxPropres)],
      ['Dettes financières', ...this.resultats.bilan.parAnnee.map(b => b.passif.dettesFinancieresLT)],
      ['TOTAL PASSIF', ...this.resultats.bilan.parAnnee.map(b => b.passif.total)],
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), 'Bilan');
  }

  _addSheetTresorerie(wb) {
    const rows = [['Période','Encaissements','Décaissements','Solde mensuel','Solde cumulé']];
    this.resultats.tresorerie.detail.forEach(m => rows.push([`A${m.annee}M${m.moisDansAnnee}`, m.encaissements, m.decaissements, m.soldeMensuel, m.soldeCumule]));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), 'Trésorerie');
  }

  _addSheetRatios(wb) {
    const rows = [['Ratio', ...this.resultats.ratios.parAnnee.map(l=>`Année ${l.annee}`)]];
    ['caf','bfr','frng','tresorerieNette','ebe','rentabiliteNette'].forEach(key => {
      rows.push([key, ...this.resultats.ratios.parAnnee.map(l => l[key])]);
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), 'Ratios');
  }
}