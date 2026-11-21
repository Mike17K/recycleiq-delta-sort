/** Minimal EL/EN translation: static strings by key, applied to [data-i] elements. Names of materials/scenes live with their data. */
const STRINGS = {
  el: {
    sub: '— Προσομοίωση', honesty: 'Προσομοίωση: οι τύποι αντικειμένων είναι γνωστοί (χωρίς όραση), οι χρόνοι είναι ενδεικτικοί και όχι μετρημένοι σε υλικό. Η γεωμετρία delta είναι ιδέα, όχι σχέδιο κατασκευής.',
    controls: 'Έλεγχος', speed: 'Ταχύτητα', rate: 'Ρυθμός εισροής (τεμ./s)', belt: 'Ταχύτητα ιμάντα (m/s)', robots: 'Ρομπότ',
    surge: 'Κορύφωση ροής ×2', seed: 'Σπόρος', labels: 'Ετικέτες', stats: 'Στατιστικά', log: 'Αρχείο αποφάσεων',
    perMin: 'τεμ./λεπτό', picked: 'ταξινομημένα', misses: 'αστοχίες', missRate: 'ποσοστό αστοχίας',
    play: 'Έναρξη', pause: 'Παύση', reset: 'Επανεκκίνηση', export: 'Εξαγωγή JSON', import: 'Εισαγωγή JSON', demo: 'Demo 90 s',
    util: 'Χρήση', purity: 'Καθαρότητα', bin: 'Κάδος', count: 'Τεμ.', na: '—', line: 'Γραμμή', allLines: 'Όλες',
    verOk: '✔ Η επανάληψη του αρχείου αναπαράγει την αρχική εκτέλεση.', verBad: '✘ Η επανάληψη ΔΕΝ ταιριάζει με την αρχική εκτέλεση.',
    replaying: 'Αναπαραγωγή αρχείου — οι έλεγχοι είναι κλειδωμένοι. Πατήστε Επανεκκίνηση για ζωντανή εκτέλεση.', badFile: 'Μη έγκυρο αρχείο.',
    phase: { move: 'Μετακίνηση', grip: 'Σύλληψη', carry: 'Μεταφορά', release: 'Απελευθέρωση', return: 'Επιστροφή', idle: 'Αδράνεια',
      goto: 'Πορεία', pull: 'Τράβηγμα κάδου', haul: 'Μεταφορά κάδου', empty: 'Άδειασμα', push: 'Επιστροφή κάδου', park: 'Στάθμευση', wait: 'Αναμονή' },
    mobile: 'Κινητά ρομπότ', fillBin: 'Γέμισμα κάδου 95%', trips: 'διαδρομές κάδων', logistics: 'Logistics', containers: 'Container', binMiss: 'Αστοχίες (κάδος μη διαθέσιμος)', swaps: 'Αλλαγές κάδου',
  },
  en: {
    sub: '— Simulation', honesty: 'Simulation only: item types are given (no vision), timings are indicative and not measured on hardware. The delta geometry is a concept, not a fabrication design.',
    controls: 'Controls', speed: 'Speed', rate: 'Spawn rate (items/s)', belt: 'Belt speed (m/s)', robots: 'Robots',
    surge: 'Surge ×2', seed: 'Seed', labels: 'Labels', stats: 'Stats', log: 'Decision log',
    perMin: 'items/min', picked: 'sorted', misses: 'misses', missRate: 'miss rate',
    play: 'Start', pause: 'Pause', reset: 'Reset', export: 'Export JSON', import: 'Import JSON', demo: 'Demo 90 s',
    util: 'Utilisation', purity: 'Purity', bin: 'Bin', count: 'Count', na: '—', line: 'Line', allLines: 'All',
    verOk: '✔ Replaying the file reproduces the original run.', verBad: '✘ Replay does NOT match the original run.',
    replaying: 'Replaying a file — controls locked. Press Reset for a live run.', badFile: 'Invalid file.',
    phase: { move: 'Move', grip: 'Grip', carry: 'Carry', release: 'Release', return: 'Return', idle: 'Idle',
      goto: 'Drive', pull: 'Pull bin', haul: 'Haul bin', empty: 'Empty', push: 'Push bin back', park: 'Park', wait: 'Wait' },
    mobile: 'Mobile robots', fillBin: 'Fill a bin to 95%', trips: 'bin trips', logistics: 'Logistics', containers: 'Containers', binMiss: 'Misses (bin unavailable)', swaps: 'Bin swaps',
  },
};

export function createI18n(initial = 'el') {
  let lang = initial;
  const listeners = [];
  const api = {
    get lang() { return lang; },
    t: key => STRINGS[lang][key],
    /** Pick the current language from a { en, el } object. */
    pick: obj => obj?.[lang] ?? obj?.en ?? '',
    set(l) { lang = l; document.documentElement.lang = l; listeners.forEach(fn => fn(l)); },
    toggle() { api.set(lang === 'el' ? 'en' : 'el'); },
    onChange: fn => listeners.push(fn),
    /** Fill every [data-i] element under root. */
    apply(root = document) { root.querySelectorAll('[data-i]').forEach(el => (el.textContent = STRINGS[lang][el.dataset.i])); },
  };
  return api;
}
