/** Tiny EL/EN dictionary shared by the dashboard and the citizen portal. */
export const DICT = {
  el: {
    title: 'RecycleIQ Ops', sub: 'Δήμος Αθηναίων · demo', demo: 'Demo', speed: 'Ταχύτητα', live: 'ζωντανά',
    k_rate: 'Ανακύκλωση (εκτίμηση)', k_share: 'Ξεχωριστή συλλογή', k_recovery: 'Ανάκτηση διαλογής', k_kgh: 'kg/ώρα διαλογής',
    k_resp: 'Χρόνος ανταπόκρισης', k_kmt: 'km ανά τόνο', k_avail: 'Διαθεσιμότητα στόλου', k_full: 'Κάδοι > 80%', k_open: 'Ανοιχτές αναφορές',
    min: 'λ (προσομ.)', tab_reports: 'Αναφορές', tab_fleet: 'Στόλος', tab_plants: 'Διαλογή',
    new: 'νέα', assigned: 'ανατέθηκε', collected: 'συλλέχθηκε', rejected: 'απορρίφθηκε',
    st_route: 'διαδρομή', st_idle: 'αναμονή', st_collecting: 'συλλογή', st_unloading: 'εκφόρτωση', st_breakdown: 'βλάβη',
    assign: 'Ανάθεση', reject: 'Απόρριψη', breakdown: 'Βλάβη', noreports: 'Καμία αναφορά ακόμη. Άνοιξε το /report από το κινητό.',
    candidate: 'νέος κάδος;', load: 'φορτίο', fill: 'πληρότητα', bin_basket: 'Καλάθι', bin_recycling: 'Κάδος ανακύκλωσης', bin_disposal: 'Κάδος απορριμμάτων',
    plant_in: 'Είσοδος', sorted: 'Διαλογή', residue: 'Υπόλειμμα', outbound: 'Τελικοί προορισμοί', flow: 'Ροή υλικών', materials: 'Υλικά',
    purity_note: 'Καθαρότητα 100% εξ ορισμού (οι τύποι δίνονται).', items_min: 'τεμ./λεπτό',
    legend_bins: 'Κάδοι', ok: 'άδειος', mid: '50–80%', hi: '> 80%', sim_note: 'Όλα τα δεδομένα στόλου και διαλογής είναι προσομοιωμένα.',
    // citizen portal
    r_title: 'Αναφορά γεμάτου κάδου', r_photo: 'Φωτογραφία κάδου', r_take: 'Τράβηξε φωτογραφία', r_loc: 'Θέση', r_locating: 'Εντοπισμός θέσης…',
    r_loc_ok: 'Η θέση βρέθηκε', r_loc_fail: 'Δεν βρέθηκε θέση. Πάτησε στο χάρτη.', r_note: 'Σχόλιο (προαιρετικά)', r_send: 'Αποστολή', r_sent: 'Ευχαριστούμε! Η αναφορά στάλθηκε.',
    r_status: 'Κατάσταση', r_again: 'Νέα αναφορά', r_err: 'Αποτυχία αποστολής', r_limit: 'Πολλές αναφορές. Δοκίμασε σε λίγο.', r_need: 'Χρειάζεται φωτογραφία και θέση.',
    r_privacy: 'Η φωτογραφία χρησιμοποιείται μόνο για την καθαριότητα. Απόφυγε πρόσωπα και πινακίδες.',
    d1: 'Ζωντανός χάρτης: 1.943 κάδοι και 10 απορριμματοφόρα', d2: 'Πολίτης στέλνει φωτογραφία γεμάτου κάδου από το κινητό', d3: 'Ανάθεση στο κοντινότερο απορριμματοφόρο',
    d4: 'Το όχημα φτάνει και συλλέγει', d5: 'Βλάβη οχήματος: οι αναφορές του ξανανατίθενται', d6: 'Ροές διαλογής: υλικά και προορισμοί', d7: 'KPI ανακύκλωσης και αποδοτικότητας σε πραγματικό χρόνο',
  },
  en: {
    title: 'RecycleIQ Ops', sub: 'City of Athens · demo', demo: 'Demo', speed: 'Speed', live: 'live',
    k_rate: 'Recycling (estimate)', k_share: 'Separate collection', k_recovery: 'Sorting recovery', k_kgh: 'sorted kg/hour',
    k_resp: 'Response time', k_kmt: 'km per tonne', k_avail: 'Fleet availability', k_full: 'Bins > 80%', k_open: 'Open reports',
    min: 'min (sim)', tab_reports: 'Reports', tab_fleet: 'Fleet', tab_plants: 'Sorting',
    new: 'new', assigned: 'assigned', collected: 'collected', rejected: 'rejected',
    st_route: 'en route', st_idle: 'idle', st_collecting: 'collecting', st_unloading: 'unloading', st_breakdown: 'breakdown',
    assign: 'Assign', reject: 'Reject', breakdown: 'Breakdown', noreports: 'No reports yet. Open /report on your phone.',
    candidate: 'new bin?', load: 'load', fill: 'fill', bin_basket: 'Litter bin', bin_recycling: 'Recycling bin', bin_disposal: 'Waste container',
    plant_in: 'Input', sorted: 'Sorted', residue: 'Residue', outbound: 'Final destinations', flow: 'Material flow', materials: 'Materials',
    purity_note: 'Purity is 100% by construction (types are given).', items_min: 'items/min',
    legend_bins: 'Bins', ok: 'empty', mid: '50–80%', hi: '> 80%', sim_note: 'All fleet and sorting data is simulated.',
    r_title: 'Report a full bin', r_photo: 'Bin photo', r_take: 'Take a photo', r_loc: 'Location', r_locating: 'Finding your location…',
    r_loc_ok: 'Location found', r_loc_fail: 'No location. Tap the map.', r_note: 'Note (optional)', r_send: 'Send', r_sent: 'Thank you! Your report was sent.',
    r_status: 'Status', r_again: 'New report', r_err: 'Could not send', r_limit: 'Too many reports. Try again shortly.', r_need: 'A photo and a location are required.',
    r_privacy: 'The photo is used only for street cleaning. Avoid faces and number plates.',
    d1: 'Live map: 1,943 bins and 10 garbage trucks', d2: 'A citizen sends a photo of a full bin from the phone', d3: 'Assigned to the nearest truck',
    d4: 'The truck arrives and collects', d5: 'Truck breakdown: its reports are reassigned', d6: 'Sorting flows: materials and destinations', d7: 'Recycling and efficiency KPIs in real time',
  },
};
export const MATERIAL_EL = { PET_CLEAR: 'PET διαφανές', PET_COLOR: 'PET χρωματιστό', HDPE: 'HDPE', PP: 'PP', PS: 'PS', ALU: 'Αλουμίνιο', GLASS: 'Γυαλί', CARTON: 'Χαρτόνι', STEEL: 'Χάλυβας', RESIDUE: 'Υπόλειμμα' };
export const MATERIAL_EN = { PET_CLEAR: 'PET clear', PET_COLOR: 'PET coloured', HDPE: 'HDPE', PP: 'PP', PS: 'PS', ALU: 'Aluminium', GLASS: 'Glass', CARTON: 'Carton', STEEL: 'Steel', RESIDUE: 'Residue' };
export const MATERIAL_COLOR = { PET_CLEAR: '#8fd3f4', PET_COLOR: '#3aa655', HDPE: '#f4b942', PP: '#e4572e', PS: '#b07cc6', ALU: '#c4c9cf', GLASS: '#5fd0b0', CARTON: '#c89b5a', STEEL: '#6f8fb0', RESIDUE: '#8a7560' };

let lang = (() => { try { return localStorage.getItem('lang') || 'el'; } catch { return 'el'; } })();
export const getLang = () => lang;
export const setLang = l => { lang = l; try { localStorage.setItem('lang', l); } catch { /* ignore */ } };
export const t = k => DICT[lang][k] ?? k;
export const material = m => (lang === 'el' ? MATERIAL_EL : MATERIAL_EN)[m] ?? m;
export function applyI18n(root = document) { root.querySelectorAll('[data-i]').forEach(e => (e.textContent = t(e.dataset.i))); document.documentElement.lang = lang; }
