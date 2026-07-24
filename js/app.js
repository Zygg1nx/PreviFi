// ============================================================
// APP.JS — Point d'entrée. Câble Modèle ↔ Moteur ↔ UI ↔ Storage.
// ============================================================
import { Projet, Entreprise, HypothesesEconomiques } from './models.js';
import { StorageManager } from './storage.js';
import { FinancialEngine, ValidationEngine } from './calculs.js';
import { UIManager } from './ui.js';
import { PDFExporter } from './exportPdf.js';
import { ExcelExporter } from './exportExcel.js';

document.addEventListener('DOMContentLoaded', () => new Application().boot());
let isThemeToggling = false;
window._projet = {};

// ============================================================
// GARDE-FOU #1 — Vérification des dépendances externes AVANT tout.
// Évite des erreurs cryptiques du type "math is not defined" ou
// "_ is not defined" qui surviennent 200 lignes plus loin dans le
// moteur de calcul, sans lien apparent avec la vraie cause (un
// script mal ordonné ou non chargé dans index.html).
// ============================================================
function verifierDependancesExternes() {
    const manquantes = [];
    if (typeof $ === 'undefined') manquantes.push('jQuery');
    if (typeof _ === 'undefined') manquantes.push('Lodash');
    if (typeof math === 'undefined') manquantes.push('Math.js');

    if (manquantes.length) {
        const message = `Librairie(s) manquante(s) : ${manquantes.join(', ')}. ` +
            `Vérifiez que les balises <script> de jQuery, Lodash et Math.js sont bien ` +
            `présentes dans index.html et chargées AVANT <script type="module" src="js/app.js">.`;
        document.body.innerHTML = `
      <div style="padding:60px;font-family:sans-serif;max-width:600px;margin:0 auto;">
        <h1 style="color:#dc2626;">⚠️ Erreur critique de chargement</h1>
        <p style="line-height:1.6;">${message}</p>
      </div>`;
        throw new Error(message);
    }
}

// ============================================================
// GARDE-FOU #2 — Bandeau d'erreur global visible, jamais silencieux.
// Toute exception JS non interceptée où que ce soit dans l'app
// (y compris dans du code tiers, une Promise, un setTimeout...)
// remonte ici et s'affiche clairement à l'écran + dans la console.
// ============================================================
function afficherBandeauErreurGlobale(message, detail = '') {
    console.error('[Erreur globale non interceptée]', message, detail);
    $('#alert-bar')
        .removeClass('hidden')
        .addClass('alert-bar-critical')
        .html(`🛑 <strong>Erreur JavaScript :</strong> ${message}
      <button id="btn-voir-console">Voir le détail (console F12)</button>`);
    $('#btn-voir-console').off('click').on('click', () => console.error(detail || message));
}

window.addEventListener('error', (event) => {
    afficherBandeauErreurGlobale(event.error?.message || event.message, event.error?.stack);
});
window.addEventListener('unhandledrejection', (event) => {
    afficherBandeauErreurGlobale(event.reason?.message || String(event.reason), event.reason?.stack);
});

/** EventBus minimaliste (Observer pattern) */
class EventBus {
    constructor() { this.listeners = {}; }
    on(evt, cb) { (this.listeners[evt] = this.listeners[evt] || []).push(cb); }
    emit(evt, payload) {
        (this.listeners[evt] || []).forEach(cb => {
            // GARDE-FOU #3 — Isole chaque listener : si l'un plante, les autres
            // s'exécutent quand même (ex: l'autosave continue même si le rendu échoue).
            try { cb(payload); }
            catch (err) { afficherBandeauErreurGlobale(`Erreur dans un listener "${evt}"`, err.stack); }
        });
    }
}

class Application {
    constructor() {
        this.storage = new StorageManager();
        this.bus = new EventBus();
        this.store = { projet: null, engine: null, resultats: null, bus: this.bus };
    }

    // Initializes the application and loads the most recent project
    boot() {
        verifierDependancesExternes();

        try {
            const liste = this.storage.listerProjets();
            if (liste.length) {
                this.store.projet = this.storage.load(liste[liste.length - 1].id);
                this._demarrerApp();
            } else {
                this._afficherWizard();
            }
            this.bus.on('data:changed', () => this._recalculer(true));
            this._bindGlobalUI();
        } catch (err) {
            afficherBandeauErreurGlobale('Échec du démarrage de l\'application', err.stack);
            console.error(err);
        }
    }

    /**
     * GARDE-FOU #5 — Recalcul protégé.
     * En cas d'erreur dans le moteur financier :
     *  - on N'ÉCRASE PAS `this.store.resultats` avec un état corrompu
     *    (on garde le dernier état valide connu, pour ne pas casser
     *    davantage l'UI) ;
     *  - on affiche un bandeau rouge explicite avec le message d'erreur ;
     *  - on logue la stack complète en console pour le debug.
     */
    _recalculer(sauvegarder = false) {
        try {
            this.store.engine = new FinancialEngine(this.store.projet);
            const resultats = this.store.engine.recalculerTout();
            this._validerStructureResultats(resultats); // GARDE-FOU #6 (voir plus bas)

            this.store.resultats = resultats;
            this.ui.store = this.store;
            this._effacerErreurCritique();
            this.ui.render();

            const validation = new ValidationEngine(this.store.projet, this.store.resultats);
            this.ui.afficherAlertes(validation.validerTout());

            if (sauvegarder) {
                this.storage.save(this.store.projet);
                window._projet = this.store.projet;
                $('#autosave-indicator').text('Enregistrement...').css('color', 'var(--warning)');
                setTimeout(() => $('#autosave-indicator').text('Enregistré ✓').css('color', 'var(--success)'), 700);
            }
        } catch (err) {
            this._afficherErreurCritique(err);
        }
    }

    /**
     * GARDE-FOU #6 — Validation de la forme des résultats.
     * Détecte immédiatement si une méthode du moteur (calculs.js) a été
     * mal renommée, oublie un `return`, ou retourne un objet incomplet.
     * Sans ce garde-fou, l'erreur ne se manifeste que bien plus tard,
     * au moment où l'UI essaie de lire un champ inexistant — rendant
     * le diagnostic beaucoup plus difficile.
     */
    _validerStructureResultats(resultats) {
        const champsAttendus = [
            'periodes', 'ca', 'achats', 'chargesFixes', 'personnel', 'investAmort',
            'empruntsCalc', 'fiscalite', 'bfr', 'compteResultat', 'tresorerie',
            'bilan', 'planFinancement', 'ratios'
        ];
        const manquants = champsAttendus.filter(c => !(c in resultats));
        if (manquants.length) {
            throw new Error(
                `Structure de résultats invalide — champ(s) manquant(s) : [${manquants.join(', ')}]. ` +
                `Une méthode du moteur de calcul (calculs.js) ne retourne plus l'objet attendu.`
            );
        }
    }

    /** Affiche un bandeau rouge explicite + conserve le dernier état valide */
    _afficherErreurCritique(err) {
        console.error('[Erreur critique — moteur financier]', err);
        $('#autosave-indicator').text('Erreur ⚠').css('color', 'var(--danger)');
        $('#alert-bar')
            .removeClass('hidden')
            .addClass('alert-bar-critical')
            .html(`
        🛑 <strong>Erreur de calcul :</strong> ${err.message}
        <button id="btn-detail-erreur">Voir la stack complète (console)</button>
      `);
        $('#btn-detail-erreur').off('click').on('click', () => console.error(err.stack));
    }

    _effacerErreurCritique() {
        $('#alert-bar').removeClass('alert-bar-critical');
    }

    _demarrerApp() {
        $('#wizard-overlay').addClass('hidden');
        $('#app').removeClass('hidden');
        $('#brand-name').text(this.store.projet.entreprise.nom);
        this.ui = new UIManager(this.store);
        this.ui.init();
        this._recalculer(false);
    }

    _afficherWizard() {
        let step = 1;
        $('#wizard-next').on('click', () => {
            $(`#wizard-step-${step}`).addClass('hidden');
            step = Math.min(step + 1, 3);
            $(`#wizard-step-${step}`).removeClass('hidden');
            $('#wizard-bar').css('width', `${step * 33}%`);
            $('#wizard-prev').toggleClass('hidden', step === 1);
            $('#wizard-next').toggleClass('hidden', step === 3);
            $('#wizard-finish').toggleClass('hidden', step !== 3);
        });
        $('#wizard-prev').on('click', () => {
            $(`#wizard-step-${step}`).addClass('hidden');
            step = Math.max(step - 1, 1);
            $(`#wizard-step-${step}`).removeClass('hidden');
            $('#wizard-bar').css('width', `${step * 33}%`);
            $('#wizard-next').removeClass('hidden'); $('#wizard-finish').addClass('hidden');
            $('#wizard-prev').toggleClass('hidden', step === 1);
        });
        $('.chip-group').on('click', '.chip', (e) => {
            $(e.currentTarget).siblings().removeClass('active');
            $(e.currentTarget).addClass('active');
        });
        $('#wizard-finish').on('click', () => {
            const entreprise = new Entreprise({
                nom: $('#w-nom').val() || 'Ma Société',
                formeJuridique: $('#w-forme').val(),
                devise: $('#w-devise').val(),
                nbAnnees: +$('#w-duree .active').data('val'),
                dateDebutActivite: $('#w-date-debut').val() || new Date().toISOString().slice(0, 10),
                tva: $('#w-tva .active').data('val') === 1,
                tauxIS: +$('#w-is').val(),
                tauxChargesSociales: +$('#w-cs').val(),
                hypotheses: new HypothesesEconomiques({ inflation: +$('#w-inflation').val(), croissance: +$('#w-croissance').val() })
            });
            this.store.projet = new Projet({ entreprise });
            this.storage.save(this.store.projet);
            this._demarrerApp();
        });
    }

    _bindGlobalUI() {
        $('#btn-theme').on('click', (e) => {
            e.preventDefault();
            if (isThemeToggling) return;

            isThemeToggling = true;
            setTimeout(() => { isThemeToggling = false; }, 500);

            const html = document.documentElement;
            html.setAttribute('data-theme', html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
        });
        $('#scenario-select').on('change', (e) => { this.store.projet.scenarioActif = e.target.value; this._recalculer(true); });
        $('#btn-undo').on('click', () => { const p = this.storage.undo(); if (p) { this.store.projet = p; this._recalculer(false); } });
        $('#btn-redo').on('click', () => { const p = this.storage.redo(); if (p) { this.store.projet = p; this._recalculer(false); } });
        $('#btn-export-json').on('click', () => this.storage.exportJSON(this.store.projet));
        $('#btn-import-json').on('click', () => $('#import-file-input').click());
        $('#import-file-input').on('change', async (e) => {
            const projet = await this.storage.importJSON(e.target.files[0]);
            this.store.projet = projet; this._recalculer(true);
        });
        $('#btn-export-pdf').on('click', () => new PDFExporter(this.store.projet, this.store.resultats).generer());
        $('#btn-export-excel').on('click', () => new ExcelExporter(this.store.projet, this.store.resultats).generer());
    }
}

// GARDE-FOU #7 — L'instance de l'app est exposée sur `window` en mode
// debug, pour pouvoir inspecter l'état complet depuis la console :
// tape `debugApp()` dans la console F12 pour voir store.projet et
// store.resultats en direct, sans avoir à mettre des breakpoints.
let appInstance = null;
window.debugApp = () => appInstance;

document.addEventListener('DOMContentLoaded', () => {
    appInstance = new Application();
    appInstance.boot();
});