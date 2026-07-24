import { Projet } from './models.js';

const LS_KEY = 'pro_forecast_project';
const LS_LIST_KEY = 'pro_forecast_list';

export class StorageManager {
  constructor() {
    this.history = [];
    this.future = [];
    this.maxHistory = 50;
    this.autosaveDebounced = _.debounce(this._save.bind(this), 800);
  }

  _save(project) {
    try {
      localStorage.setItem(`${LS_KEY}_${project.id}`, JSON.stringify(project.toJSON()));
      this._updateProjectList(project);
      return true;
    } catch (e) {
      console.error('LocalStorage save error', e);
      return false;
    }
  }

  save(project) {
    const serialized = JSON.stringify(project.toJSON());
    if (this.history[this.history.length - 1] === serialized) return; 

    this.history.push(serialized);
    if (this.history.length > this.maxHistory) this.history.shift();
    this.future = [];
    this.autosaveDebounced(project);
  }

  undo() {
    if (this.history.length < 2) return null;
    this.future.push(this.history.pop());
    return Projet.fromJSON(JSON.parse(this.history[this.history.length - 1]));
  }

  redo() {
    if (!this.future.length) return null;
    const next = this.future.pop();
    this.history.push(next);
    return Projet.fromJSON(JSON.parse(next));
  }

  load(id) {
    const raw = localStorage.getItem(`${LS_KEY}_${id}`);
    return raw ? Projet.fromJSON(JSON.parse(raw)) : null;
  }

  listerProjets() {
    return JSON.parse(localStorage.getItem(LS_LIST_KEY) || '[]');
  }

  _updateProjectList(project) {
    const list = this.listerProjets();
    const idx = list.findIndex(p => p.id === project.id);
    const entry = { id: project.id, name: project.entreprise.nom, updatedAt: project.meta.updatedAt };
    
    if (idx >= 0) list[idx] = entry;
    else list.push(entry);
    
    localStorage.setItem(LS_LIST_KEY, JSON.stringify(list));
  }

  duplicateProject(project) {
    const clone = Projet.fromJSON(project.toJSON());
    clone.id = crypto.randomUUID();
    clone.entreprise.nom = `${project.entreprise.nom} (copy)`;
    this._save(clone);
    return clone;
  }

  deleteProject(id) {
    localStorage.removeItem(`${LS_KEY}_${id}`);
    const list = this.listerProjets().filter(p => p.id !== id);
    localStorage.setItem(LS_LIST_KEY, JSON.stringify(list));
  }

  exportJSON(project) {
    const blob = new Blob([JSON.stringify(project.toJSON(), null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${project.entreprise.nom.replace(/\s+/g, '_')}_forecast.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  importJSON(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = e => {
        try { resolve(Projet.fromJSON(JSON.parse(e.target.result))); }
        catch (err) { reject(err); }
      };
      reader.onerror = reject;
      reader.readAsText(file);
    });
  }
}