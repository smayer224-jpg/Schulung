"use strict";

// ---------- Grunddaten ----------

const SPEICHER_SCHLUESSEL = "pferdeKalender";

const KATEGORIEN = [
  { schluessel: "training", name: "Training", farbe: "#2e9e4f" },
  { schluessel: "gesundheit", name: "Gesundheit", farbe: "#2f6fd6" },
  { schluessel: "medikamente", name: "Medikamente", farbe: "#8a4fd1" },
  { schluessel: "hufschmied", name: "Hufschmied", farbe: "#e07b12" },
  { schluessel: "tierarzt", name: "Tierarzt", farbe: "#d64545" },
  { schluessel: "sonstiges", name: "Sonstiges", farbe: "#7a7a7a" },
];
const KATEGORIE_SCHLUESSEL = KATEGORIEN.map((k) => k.schluessel);
const DATUM_MUSTER = /^\d{4}-\d{2}-\d{2}$/;
const FARB_MUSTER = /^#[0-9a-fA-F]{6}$/;
const FOTO_ID_MUSTER = /^[a-z0-9-]{1,40}$/;

// Das Pferdebild wird auf diese Größe (in Pixeln) verkleinert,
// damit es in den Browser-Speicher passt.
const BILD_GROESSE = 240;
const BILD_MAX_LAENGE = 1000000; // höchstens ca. 1 MB Text

// Fotos bei den Einträgen: längste Seite höchstens so viele Pixel
const FOTO_MAX_SEITE = 1280;
const FOTO_QUALITAET = 0.75;
const FOTO_MAX_ANZAHL = 10; // pro Kategorie und Tag
const FOTO_MAX_LAENGE = 5000000; // höchstens ca. 5 MB Text pro Foto

function leereDaten() {
  return {
    version: 2,
    pferd: { name: "", rasse: "", geburtsjahr: null, bild: "" },
    farben: {},
    tage: {}, // Texte:  { "2026-11-13": { training: "..." } }
    fotos: {}, // Fotos: { "2026-11-13": { training: ["foto-id", ...] } }
  };
}

let daten = leereDaten();
let angezeigterMonat = ersterTagDesMonats(new Date());
let offenerTag = null; // Datum-Schlüssel des geöffneten Tages
let bildEntwurf = ""; // Bild im Steckbrief-Dialog, bevor man speichert

// Fotos in der Tagesansicht, bevor man speichert
let fotoEntwurf = {}; // { training: [{ id, bild }], ... }
let fotoVorher = new Set(); // Foto-IDs, die beim Öffnen schon gespeichert waren
let fotoNichtGeladen = {}; // Foto-IDs, die beim Öffnen nicht geladen werden konnten
let fotoZielKategorie = null; // Kategorie, zu der gerade ein Foto ausgewählt wird

// ---------- Hilfsfunktionen für Datum ----------

function ersterTagDesMonats(datum) {
  return new Date(datum.getFullYear(), datum.getMonth(), 1);
}

function zweistellig(zahl) {
  return String(zahl).padStart(2, "0");
}

// Macht aus einem Datum den Text "JJJJ-MM-TT"
function datumSchluessel(datum) {
  return datum.getFullYear() + "-" + zweistellig(datum.getMonth() + 1) + "-" + zweistellig(datum.getDate());
}

function schluesselZuDatum(schluessel) {
  const [jahr, monat, tag] = schluessel.split("-").map(Number);
  return new Date(jahr, monat - 1, tag);
}

function heuteSchluessel() {
  return datumSchluessel(new Date());
}

// Anzahl ganzer Tage zwischen zwei Daten (ohne Probleme bei Sommerzeit)
function tageZwischen(von, bis) {
  const a = Date.UTC(von.getFullYear(), von.getMonth(), von.getDate());
  const b = Date.UTC(bis.getFullYear(), bis.getMonth(), bis.getDate());
  return Math.round((b - a) / 86400000);
}

// ---------- Einträge abfragen ----------

function fotoIds(schluessel, kategorie) {
  const tag = daten.fotos[schluessel];
  return (tag && tag[kategorie]) || [];
}

// Hat diese Kategorie an diesem Tag einen Text oder ein Foto?
function hatEintrag(schluessel, kategorie) {
  const texte = daten.tage[schluessel];
  return Boolean(texte && texte[kategorie]) || fotoIds(schluessel, kategorie).length > 0;
}

// Alle Tage, an denen es Texte oder Fotos gibt
function alleTagesSchluessel() {
  return [...new Set([...Object.keys(daten.tage), ...Object.keys(daten.fotos)])];
}

// ---------- Speichern und Laden ----------

// Prüft Daten (z. B. aus einer Sicherungsdatei) und gibt saubere Daten zurück.
// Bei falschem Aufbau gibt es null zurück.
function datenPruefen(roh) {
  if (!roh || typeof roh !== "object" || Array.isArray(roh)) return null;
  if (!roh.tage || typeof roh.tage !== "object" || Array.isArray(roh.tage)) return null;

  const sauber = leereDaten();

  const pferd = roh.pferd;
  if (pferd && typeof pferd === "object") {
    if (typeof pferd.name === "string") sauber.pferd.name = pferd.name.slice(0, 40);
    if (typeof pferd.rasse === "string") sauber.pferd.rasse = pferd.rasse.slice(0, 40);
    const jahr = Number(pferd.geburtsjahr);
    if (pferd.geburtsjahr !== null && Number.isInteger(jahr) && jahr > 1900 && jahr < 3000) {
      sauber.pferd.geburtsjahr = jahr;
    }
    if (typeof pferd.bild === "string" && pferd.bild.startsWith("data:image/") && pferd.bild.length <= BILD_MAX_LAENGE) {
      sauber.pferd.bild = pferd.bild;
    }
  }

  if (roh.farben && typeof roh.farben === "object") {
    for (const kategorie of KATEGORIE_SCHLUESSEL) {
      const farbe = roh.farben[kategorie];
      if (typeof farbe === "string" && FARB_MUSTER.test(farbe)) sauber.farben[kategorie] = farbe.toLowerCase();
    }
  }

  for (const [schluessel, eintraege] of Object.entries(roh.tage)) {
    if (!DATUM_MUSTER.test(schluessel)) return null;
    if (!eintraege || typeof eintraege !== "object" || Array.isArray(eintraege)) return null;
    const tag = {};
    for (const kategorie of KATEGORIE_SCHLUESSEL) {
      const text = eintraege[kategorie];
      if (text === undefined) continue;
      if (typeof text !== "string") return null;
      if (text.trim() !== "") tag[kategorie] = text;
    }
    if (Object.keys(tag).length > 0) sauber.tage[schluessel] = tag;
  }

  // Fotos sind neu (Version 2). Ältere Daten haben keine, das ist in Ordnung.
  if (roh.fotos !== undefined) {
    if (!roh.fotos || typeof roh.fotos !== "object" || Array.isArray(roh.fotos)) return null;
    for (const [schluessel, eintraege] of Object.entries(roh.fotos)) {
      if (!DATUM_MUSTER.test(schluessel)) return null;
      if (!eintraege || typeof eintraege !== "object" || Array.isArray(eintraege)) return null;
      const tag = {};
      for (const kategorie of KATEGORIE_SCHLUESSEL) {
        const ids = eintraege[kategorie];
        if (ids === undefined) continue;
        if (!Array.isArray(ids)) return null;
        const gueltig = ids.filter((id) => typeof id === "string" && FOTO_ID_MUSTER.test(id));
        if (gueltig.length > 0) tag[kategorie] = gueltig.slice(0, FOTO_MAX_ANZAHL);
      }
      if (Object.keys(tag).length > 0) sauber.fotos[schluessel] = tag;
    }
  }

  return sauber;
}

function datenLaden() {
  try {
    const text = localStorage.getItem(SPEICHER_SCHLUESSEL);
    if (!text) return leereDaten();
    return datenPruefen(JSON.parse(text)) || leereDaten();
  } catch (fehler) {
    return leereDaten();
  }
}

function datenSpeichern() {
  try {
    localStorage.setItem(SPEICHER_SCHLUESSEL, JSON.stringify(daten));
    return true;
  } catch (fehler) {
    zeigeMeldung("Speichern im Browser hat nicht geklappt. Lade zur Sicherheit eine Sicherung herunter.", "fehler");
    return false;
  }
}

// ---------- Foto-Speicher (IndexedDB) ----------
// Fotos sind zu groß für localStorage. Deshalb liegen sie in einer
// eigenen kleinen Datenbank im Browser. In "daten.fotos" stehen nur ihre IDs.

const FOTO_DB_NAME = "pferdeKalenderFotos";
const FOTO_ABLAGE = "fotos";
let fotoDbVersprechen = null;

function fotoDb() {
  if (!fotoDbVersprechen) {
    fotoDbVersprechen = new Promise((ok, fehler) => {
      if (!("indexedDB" in window)) {
        fehler(new Error("Kein Foto-Speicher vorhanden"));
        return;
      }
      const anfrage = indexedDB.open(FOTO_DB_NAME, 1);
      anfrage.onupgradeneeded = () => anfrage.result.createObjectStore(FOTO_ABLAGE);
      anfrage.onsuccess = () => ok(anfrage.result);
      anfrage.onerror = () => fehler(anfrage.error);
    });
    // Bei einem Fehler beim nächsten Mal neu versuchen
    fotoDbVersprechen.catch(() => { fotoDbVersprechen = null; });
  }
  return fotoDbVersprechen;
}

// Führt Arbeit im Foto-Speicher aus. "arbeit" bekommt die Ablage
// und gibt eine Funktion zurück, die am Ende das Ergebnis liefert.
async function fotoTransaktion(modus, arbeit) {
  const db = await fotoDb();
  return new Promise((ok, fehler) => {
    const tx = db.transaction(FOTO_ABLAGE, modus);
    let ergebnis;
    try {
      ergebnis = arbeit(tx.objectStore(FOTO_ABLAGE));
    } catch (f) {
      tx.abort();
      fehler(f);
      return;
    }
    tx.oncomplete = () => ok(typeof ergebnis === "function" ? ergebnis() : undefined);
    tx.onerror = () => fehler(tx.error);
    tx.onabort = () => fehler(tx.error || new Error("Abgebrochen"));
  });
}

// Liest einige Fotos: gibt { id: bild } zurück
function fotosLesen(ids) {
  return fotoTransaktion("readonly", (ablage) => {
    const anfragen = ids.map((id) => [id, ablage.get(id)]);
    return () => {
      const ergebnis = {};
      for (const [id, anfrage] of anfragen) {
        if (typeof anfrage.result === "string") ergebnis[id] = anfrage.result;
      }
      return ergebnis;
    };
  });
}

// Liest alle Fotos: gibt { id: bild } zurück
function alleFotosLesen() {
  return fotoTransaktion("readonly", (ablage) => {
    const ergebnis = {};
    const anfrage = ablage.openCursor();
    anfrage.onsuccess = () => {
      const zeiger = anfrage.result;
      if (zeiger) {
        ergebnis[zeiger.key] = zeiger.value;
        zeiger.continue();
      }
    };
    return () => ergebnis;
  });
}

function fotosHinzufuegen(liste) {
  return fotoTransaktion("readwrite", (ablage) => {
    for (const foto of liste) ablage.put(foto.bild, foto.id);
  });
}

function fotosLoeschen(ids) {
  return fotoTransaktion("readwrite", (ablage) => {
    for (const id of ids) ablage.delete(id);
  });
}

// Ersetzt alle Fotos auf einmal (beim Einlesen einer Sicherung).
// Klappt etwas nicht, bleibt der alte Zustand erhalten.
function alleFotosErsetzen(fotoDaten) {
  return fotoTransaktion("readwrite", (ablage) => {
    ablage.clear();
    for (const [id, bild] of Object.entries(fotoDaten)) ablage.put(bild, id);
  });
}

function neueFotoId() {
  return Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
}

// Bittet den Browser, die Daten nicht von selbst zu löschen, wenn wenig Platz ist
function dauerhaftenSpeicherAnfragen() {
  if (navigator.storage && navigator.storage.persist) {
    navigator.storage.persist().catch(() => {});
  }
}

// ---------- Bilder laden und verkleinern ----------

function bildLaden(datei) {
  return new Promise((ok, fehler) => {
    const adresse = URL.createObjectURL(datei);
    const bild = new Image();
    bild.onload = () => {
      URL.revokeObjectURL(adresse);
      ok(bild);
    };
    bild.onerror = () => {
      URL.revokeObjectURL(adresse);
      fehler(new Error("Bild konnte nicht geöffnet werden"));
    };
    bild.src = adresse;
  });
}

// Quadratisch zuschneiden (für das Pferdebild)
function bildQuadratisch(bild, groesse) {
  const seite = Math.min(bild.naturalWidth, bild.naturalHeight);
  const x = (bild.naturalWidth - seite) / 2;
  const y = (bild.naturalHeight - seite) / 2;
  const leinwand = document.createElement("canvas");
  leinwand.width = groesse;
  leinwand.height = groesse;
  const malen = leinwand.getContext("2d");
  malen.fillStyle = "#ffffff";
  malen.fillRect(0, 0, groesse, groesse);
  malen.drawImage(bild, x, y, seite, seite, 0, 0, groesse, groesse);
  return leinwand.toDataURL("image/jpeg", 0.85);
}

// Verkleinern, ohne zuzuschneiden (für Fotos bei Einträgen)
function bildVerkleinert(bild, maxSeite, qualitaet) {
  const faktor = Math.min(1, maxSeite / Math.max(bild.naturalWidth, bild.naturalHeight));
  const breite = Math.max(1, Math.round(bild.naturalWidth * faktor));
  const hoehe = Math.max(1, Math.round(bild.naturalHeight * faktor));
  const leinwand = document.createElement("canvas");
  leinwand.width = breite;
  leinwand.height = hoehe;
  const malen = leinwand.getContext("2d");
  malen.fillStyle = "#ffffff";
  malen.fillRect(0, 0, breite, hoehe);
  malen.drawImage(bild, 0, 0, breite, hoehe);
  return leinwand.toDataURL("image/jpeg", qualitaet);
}

// ---------- Farben ----------

function standardFarbe(schluessel) {
  return KATEGORIEN.find((k) => k.schluessel === schluessel).farbe;
}

function aktuelleFarbe(schluessel) {
  return daten.farben[schluessel] || standardFarbe(schluessel);
}

// Schreibt die Farben in die CSS-Variablen (z. B. --training).
// Dadurch ändern sich alle Punkte auf der Seite auf einmal.
function wendeFarbenAn() {
  for (const kategorie of KATEGORIE_SCHLUESSEL) {
    document.documentElement.style.setProperty("--" + kategorie, aktuelleFarbe(kategorie));
  }
}

function oeffneFarben() {
  const felder = document.getElementById("farbFelder");
  felder.replaceChildren();
  for (const kategorie of KATEGORIEN) {
    const label = document.createElement("label");
    label.className = "farb-feld";
    label.appendChild(document.createTextNode(kategorie.name));
    const eingabe = document.createElement("input");
    eingabe.type = "color";
    eingabe.name = kategorie.schluessel;
    eingabe.value = aktuelleFarbe(kategorie.schluessel);
    label.appendChild(eingabe);
    felder.appendChild(label);
  }
  document.getElementById("farbDialog").showModal();
}

function farbenAufStandard() {
  document.querySelectorAll("#farbFelder input[type=color]").forEach((eingabe) => {
    eingabe.value = standardFarbe(eingabe.name);
  });
}

function speichereFarben() {
  const neueFarben = {};
  document.querySelectorAll("#farbFelder input[type=color]").forEach((eingabe) => {
    const farbe = eingabe.value.toLowerCase();
    // Nur Farben merken, die vom Standard abweichen
    if (FARB_MUSTER.test(farbe) && farbe !== standardFarbe(eingabe.name)) neueFarben[eingabe.name] = farbe;
  });
  daten.farben = neueFarben;
  datenSpeichern();
  wendeFarbenAn();
}

// ---------- Anzeige: Steckbrief ----------

// Zeigt im Kreis das Bild oder den Anfangsbuchstaben
function fuelleAvatar(element, bild, name) {
  element.replaceChildren();
  if (bild) {
    const img = document.createElement("img");
    img.src = bild;
    img.alt = "";
    element.appendChild(img);
  } else {
    element.textContent = name.trim() ? name.trim().charAt(0).toUpperCase() : "?";
  }
}

function zeigeSteckbrief() {
  const { name, rasse, geburtsjahr, bild } = daten.pferd;
  const anzeigeName = name.trim() || "Mein Pferd";

  document.getElementById("pferdName").textContent = anzeigeName;
  fuelleAvatar(document.getElementById("avatar"), bild, name);

  const teile = [];
  if (rasse.trim()) teile.push(rasse.trim());
  if (geburtsjahr) {
    const alter = new Date().getFullYear() - geburtsjahr;
    if (alter >= 0) teile.push(alter === 1 ? "1 Jahr" : alter + " Jahre");
  }
  document.getElementById("pferdInfo").textContent =
    teile.length > 0 ? teile.join(" · ") : "Noch keine Angaben";
}

// ---------- Anzeige: Nächste Termine ----------

function naechsterTermin(kategorie) {
  const heute = heuteSchluessel();
  const kommende = alleTagesSchluessel()
    .filter((schluessel) => schluessel >= heute && hatEintrag(schluessel, kategorie))
    .sort();
  return kommende.length > 0 ? kommende[0] : null;
}

function terminText(schluessel) {
  if (!schluessel) return "Kein Termin geplant";
  const datum = schluesselZuDatum(schluessel);
  const abstand = tageZwischen(new Date(), datum);
  const kurz = zweistellig(datum.getDate()) + "." + zweistellig(datum.getMonth() + 1) + ".";
  if (abstand === 0) return "heute (" + kurz + ")";
  if (abstand === 1) return "morgen (" + kurz + ")";
  return "in " + abstand + " Tagen (" + kurz + ")";
}

function zeigeTermine() {
  document.getElementById("terminHufschmied").textContent = terminText(naechsterTermin("hufschmied"));
  document.getElementById("terminTierarzt").textContent = terminText(naechsterTermin("tierarzt"));
}

// ---------- Anzeige: Kalender ----------

function zeigeKalender() {
  const jahr = angezeigterMonat.getFullYear();
  const monat = angezeigterMonat.getMonth();

  document.getElementById("monatTitel").textContent =
    angezeigterMonat.toLocaleDateString("de-DE", { month: "long", year: "numeric" });

  const raster = document.getElementById("raster");
  raster.replaceChildren();

  // Leere Felder vor dem 1. des Monats (Woche beginnt am Montag)
  const versatz = (new Date(jahr, monat, 1).getDay() + 6) % 7;
  for (let i = 0; i < versatz; i++) {
    const leer = document.createElement("div");
    leer.className = "tag leer";
    raster.appendChild(leer);
  }

  const anzahlTage = new Date(jahr, monat + 1, 0).getDate();
  const heute = heuteSchluessel();

  for (let tagNr = 1; tagNr <= anzahlTage; tagNr++) {
    const datum = new Date(jahr, monat, tagNr);
    const schluessel = datumSchluessel(datum);

    const knopf = document.createElement("button");
    knopf.type = "button";
    knopf.className = "tag";
    if (schluessel === heute) knopf.classList.add("heute");

    const zahl = document.createElement("span");
    zahl.className = "tag-zahl";
    zahl.textContent = tagNr;
    knopf.appendChild(zahl);

    const punkte = document.createElement("span");
    punkte.className = "tag-punkte";
    const namen = [];
    for (const kategorie of KATEGORIEN) {
      if (hatEintrag(schluessel, kategorie.schluessel)) {
        const punkt = document.createElement("span");
        punkt.className = "punkt";
        punkt.style.setProperty("--farbe", "var(--" + kategorie.schluessel + ")");
        punkte.appendChild(punkt);
        namen.push(kategorie.name);
      }
    }
    knopf.appendChild(punkte);

    let beschreibung = datum.toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long" });
    if (schluessel === heute) beschreibung += ", heute";
    beschreibung += namen.length > 0 ? ": " + namen.join(", ") : ": keine Einträge";
    knopf.setAttribute("aria-label", beschreibung);

    knopf.addEventListener("click", () => oeffneTag(schluessel));
    raster.appendChild(knopf);
  }
}

function zeigeLegende() {
  const liste = document.getElementById("legende");
  liste.replaceChildren();
  for (const kategorie of KATEGORIEN) {
    const eintrag = document.createElement("li");
    const punkt = document.createElement("span");
    punkt.className = "punkt";
    punkt.style.setProperty("--farbe", "var(--" + kategorie.schluessel + ")");
    eintrag.appendChild(punkt);
    eintrag.appendChild(document.createTextNode(kategorie.name));
    liste.appendChild(eintrag);
  }
}

function allesAnzeigen() {
  zeigeSteckbrief();
  zeigeTermine();
  zeigeKalender();
}

// ---------- Tagesansicht ----------

function zeigeTagMeldung(text, art) {
  const meldung = document.getElementById("tagMeldung");
  meldung.textContent = text;
  meldung.className = "meldung " + (art || "");
}

async function oeffneTag(schluessel) {
  // Zuerst die Fotos dieses Tages aus dem Foto-Speicher holen
  const alleIds = KATEGORIE_SCHLUESSEL.flatMap((k) => fotoIds(schluessel, k));
  let geladen = {};
  let ladeFehler = false;
  if (alleIds.length > 0) {
    try {
      geladen = await fotosLesen(alleIds);
    } catch (fehler) {
      ladeFehler = true;
    }
  }

  // Erst danach den Zwischenstand setzen (siehe "close"-Ereignis in start())
  offenerTag = schluessel;
  const datum = schluesselZuDatum(schluessel);
  document.getElementById("tagTitel").textContent =
    datum.toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  if (ladeFehler) zeigeTagMeldung("Die Fotos konnten nicht geladen werden.", "fehler");
  else zeigeTagMeldung("");

  fotoEntwurf = {};
  fotoVorher = new Set();
  fotoNichtGeladen = {};
  for (const kategorie of KATEGORIE_SCHLUESSEL) {
    const ids = fotoIds(schluessel, kategorie);
    fotoEntwurf[kategorie] = ids.filter((id) => geladen[id]).map((id) => ({ id, bild: geladen[id] }));
    for (const foto of fotoEntwurf[kategorie]) fotoVorher.add(foto.id);
    // Fotos, die gerade nicht geladen werden konnten, beim Speichern behalten
    const fehlende = ids.filter((id) => !geladen[id]);
    if (fehlende.length > 0) fotoNichtGeladen[kategorie] = fehlende;
  }

  const eintraege = daten.tage[schluessel] || {};
  const felder = document.getElementById("tagFelder");
  felder.replaceChildren();

  for (const kategorie of KATEGORIEN) {
    const feld = document.createElement("div");
    feld.className = "feld";

    const kopf = document.createElement("label");
    kopf.className = "feld-kopf";
    kopf.htmlFor = "feld-" + kategorie.schluessel;
    const punkt = document.createElement("span");
    punkt.className = "punkt";
    punkt.style.setProperty("--farbe", "var(--" + kategorie.schluessel + ")");
    kopf.appendChild(punkt);
    kopf.appendChild(document.createTextNode(kategorie.name));

    const textfeld = document.createElement("textarea");
    textfeld.id = "feld-" + kategorie.schluessel;
    textfeld.name = kategorie.schluessel;
    textfeld.rows = 2;
    textfeld.value = eintraege[kategorie.schluessel] || "";

    const fotos = document.createElement("div");
    fotos.className = "fotos";
    fotos.dataset.kategorie = kategorie.schluessel;

    feld.appendChild(kopf);
    feld.appendChild(textfeld);
    feld.appendChild(fotos);
    felder.appendChild(feld);

    zeigeFotos(kategorie.schluessel);
  }

  const dialog = document.getElementById("tagDialog");
  if (!dialog.open) dialog.showModal();
}

// Zeichnet die Vorschaubilder einer Kategorie neu
function zeigeFotos(kategorie) {
  const bereich = document.querySelector('#tagFelder .fotos[data-kategorie="' + kategorie + '"]');
  if (!bereich) return;
  bereich.replaceChildren();
  const name = KATEGORIEN.find((k) => k.schluessel === kategorie).name;
  const liste = fotoEntwurf[kategorie] || [];

  liste.forEach((foto, nummer) => {
    const mini = document.createElement("div");
    mini.className = "foto-mini";

    const oeffnen = document.createElement("button");
    oeffnen.type = "button";
    oeffnen.className = "foto-oeffnen";
    oeffnen.setAttribute("aria-label", "Foto " + (nummer + 1) + " von " + name + " groß anzeigen");
    const img = document.createElement("img");
    img.src = foto.bild;
    img.alt = "";
    oeffnen.appendChild(img);
    oeffnen.addEventListener("click", () => zeigeFotoGross(foto.bild));

    const weg = document.createElement("button");
    weg.type = "button";
    weg.className = "foto-weg";
    weg.setAttribute("aria-label", "Foto " + (nummer + 1) + " von " + name + " entfernen");
    const kreuz = document.createElement("span");
    kreuz.textContent = "×";
    kreuz.setAttribute("aria-hidden", "true");
    weg.appendChild(kreuz);
    weg.addEventListener("click", () => {
      fotoEntwurf[kategorie] = fotoEntwurf[kategorie].filter((f) => f.id !== foto.id);
      zeigeFotos(kategorie);
    });

    mini.appendChild(oeffnen);
    mini.appendChild(weg);
    bereich.appendChild(mini);
  });

  if (liste.length < FOTO_MAX_ANZAHL) {
    const plus = document.createElement("button");
    plus.type = "button";
    plus.className = "knopf klein foto-plus";
    plus.textContent = "+ Foto";
    plus.setAttribute("aria-label", "Foto zu " + name + " hinzufügen");
    plus.addEventListener("click", () => {
      fotoZielKategorie = kategorie;
      const auswahl = document.getElementById("fotoAuswahl");
      auswahl.value = "";
      auswahl.click();
    });
    bereich.appendChild(plus);
  }
}

async function fotosAusgewaehlt(dateien) {
  const kategorie = fotoZielKategorie;
  if (!kategorie || !offenerTag) return;
  const platz = FOTO_MAX_ANZAHL - fotoEntwurf[kategorie].length;
  const auswahl = Array.from(dateien).slice(0, Math.max(0, platz));
  if (auswahl.length === 0) return;

  zeigeTagMeldung(auswahl.length === 1 ? "Foto wird geladen …" : "Fotos werden geladen …");
  let fehlgeschlagen = 0;
  for (const datei of auswahl) {
    try {
      const bild = await bildLaden(datei);
      const fotoText = bildVerkleinert(bild, FOTO_MAX_SEITE, FOTO_QUALITAET);
      if (fotoText.length > FOTO_MAX_LAENGE) throw new Error("zu groß");
      fotoEntwurf[kategorie].push({ id: neueFotoId(), bild: fotoText });
    } catch (fehler) {
      fehlgeschlagen++;
    }
  }
  zeigeFotos(kategorie);

  if (fehlgeschlagen > 0) {
    zeigeTagMeldung("Ein Foto konnte nicht geöffnet werden. Versuche ein JPG- oder PNG-Bild.", "fehler");
  } else if (dateien.length > auswahl.length) {
    zeigeTagMeldung("Pro Kategorie sind höchstens " + FOTO_MAX_ANZAHL + " Fotos möglich.", "fehler");
  } else {
    zeigeTagMeldung("");
  }
}

function zeigeFotoGross(bild) {
  document.getElementById("fotoGross").src = bild;
  document.getElementById("fotoDialog").showModal();
}

// Speichert Texte und Fotos des offenen Tages. Gibt true zurück, wenn es geklappt hat.
async function speichereTag() {
  const schluessel = offenerTag;
  if (!schluessel) return true;

  // Texte
  const texte = {};
  document.querySelectorAll("#tagFelder textarea").forEach((feld) => {
    const text = feld.value.trim();
    if (text !== "") texte[feld.name] = text;
  });

  // Fotos: was ist neu, was wurde entfernt?
  const neueIds = {};
  const neueFotos = [];
  const bleibende = new Set();
  for (const kategorie of KATEGORIE_SCHLUESSEL) {
    const liste = fotoEntwurf[kategorie] || [];
    const ids = [...(fotoNichtGeladen[kategorie] || []), ...liste.map((f) => f.id)];
    if (ids.length > 0) neueIds[kategorie] = ids;
    for (const foto of liste) {
      bleibende.add(foto.id);
      if (!fotoVorher.has(foto.id)) neueFotos.push(foto);
    }
  }
  const entfernte = [...fotoVorher].filter((id) => !bleibende.has(id));

  // 1. Neue Fotos in den Foto-Speicher schreiben
  if (neueFotos.length > 0) {
    try {
      await fotosHinzufuegen(neueFotos);
      dauerhaftenSpeicherAnfragen();
    } catch (fehler) {
      zeigeTagMeldung("Die Fotos konnten nicht gespeichert werden. Vielleicht ist der Speicher voll.", "fehler");
      return false;
    }
  }

  // 2. Texte und Foto-Liste speichern
  const vorherTexte = daten.tage[schluessel];
  const vorherFotos = daten.fotos[schluessel];
  if (Object.keys(texte).length > 0) daten.tage[schluessel] = texte;
  else delete daten.tage[schluessel];
  if (Object.keys(neueIds).length > 0) daten.fotos[schluessel] = neueIds;
  else delete daten.fotos[schluessel];

  if (!datenSpeichern()) {
    // Zurück zum alten Zustand
    if (vorherTexte) daten.tage[schluessel] = vorherTexte; else delete daten.tage[schluessel];
    if (vorherFotos) daten.fotos[schluessel] = vorherFotos; else delete daten.fotos[schluessel];
    fotosLoeschen(neueFotos.map((f) => f.id)).catch(() => {});
    zeigeTagMeldung("Speichern hat nicht geklappt. Lade zur Sicherheit eine Sicherung herunter.", "fehler");
    return false;
  }

  // 3. Entfernte Fotos erst jetzt löschen
  if (entfernte.length > 0) fotosLoeschen(entfernte).catch(() => {});

  allesAnzeigen();
  return true;
}

// ---------- Steckbrief bearbeiten ----------

function zeigeBildVorschau() {
  fuelleAvatar(
    document.getElementById("bildVorschau"),
    bildEntwurf,
    document.getElementById("eingabeName").value
  );
  document.getElementById("bildEntfernen").hidden = !bildEntwurf;
}

function oeffneSteckbrief() {
  document.getElementById("eingabeName").value = daten.pferd.name;
  document.getElementById("eingabeRasse").value = daten.pferd.rasse;
  const jahrFeld = document.getElementById("eingabeJahr");
  jahrFeld.max = new Date().getFullYear();
  jahrFeld.value = daten.pferd.geburtsjahr || "";
  bildEntwurf = daten.pferd.bild;
  document.getElementById("bildMeldung").textContent = "";
  zeigeBildVorschau();
  document.getElementById("pferdDialog").showModal();
}

// Liest das Pferdebild ein, schneidet es quadratisch zu und verkleinert es.
async function bildVerarbeiten(datei) {
  const meldung = document.getElementById("bildMeldung");
  meldung.className = "meldung";
  meldung.textContent = "Bild wird geladen …";
  try {
    const bild = await bildLaden(datei);
    bildEntwurf = bildQuadratisch(bild, BILD_GROESSE);
    meldung.textContent = "";
    zeigeBildVorschau();
  } catch (fehler) {
    meldung.className = "meldung fehler";
    meldung.textContent = "Dieses Bild konnte nicht geöffnet werden. Versuche ein JPG- oder PNG-Bild.";
  }
}

function speichereSteckbrief() {
  const vorher = { ...daten.pferd };
  daten.pferd.name = document.getElementById("eingabeName").value.trim();
  daten.pferd.rasse = document.getElementById("eingabeRasse").value.trim();
  const jahr = parseInt(document.getElementById("eingabeJahr").value, 10);
  daten.pferd.geburtsjahr = Number.isInteger(jahr) && jahr > 1900 && jahr <= new Date().getFullYear() ? jahr : null;
  daten.pferd.bild = bildEntwurf;
  if (!datenSpeichern()) {
    // Wenn der Speicher voll ist: alten Zustand behalten
    daten.pferd = vorher;
  }
  zeigeSteckbrief();
}

// ---------- Sicherung ----------

function zeigeMeldung(text, art) {
  const meldung = document.getElementById("meldung");
  meldung.textContent = text;
  meldung.className = "meldung " + (art || "");
}

async function sicherungHerunterladen() {
  zeigeMeldung("Sicherung wird erstellt …", "");

  // Nur Fotos mitnehmen, die auch zu einem Eintrag gehören
  const benutzt = new Set();
  for (const tag of Object.values(daten.fotos)) {
    for (const ids of Object.values(tag)) ids.forEach((id) => benutzt.add(id));
  }
  const fotoDaten = {};
  if (benutzt.size > 0) {
    try {
      const alle = await alleFotosLesen();
      for (const id of benutzt) if (alle[id]) fotoDaten[id] = alle[id];
    } catch (fehler) {
      zeigeMeldung("Die Fotos konnten nicht gelesen werden. Die Sicherung wurde nicht erstellt.", "fehler");
      return;
    }
  }

  const inhalt = JSON.stringify({ ...daten, fotoDaten }, null, 2);
  const datei = new Blob([inhalt], { type: "application/json" });
  const adresse = URL.createObjectURL(datei);
  const link = document.createElement("a");
  link.href = adresse;
  link.download = "pferd-sicherung.json";
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(adresse), 10000);
  zeigeMeldung("Sicherung wurde heruntergeladen.", "ok");
}

// Prüft die Fotos aus einer Sicherungsdatei. Entfernt Verweise auf Fotos,
// die in der Datei fehlen. Gibt { id: bild } mit allen benutzten Fotos zurück.
function fotoDatenPruefen(neueDaten, roheFotoDaten) {
  const quelle = roheFotoDaten && typeof roheFotoDaten === "object" && !Array.isArray(roheFotoDaten) ? roheFotoDaten : {};
  const sauber = {};
  for (const [schluessel, tag] of Object.entries(neueDaten.fotos)) {
    for (const kategorie of Object.keys(tag)) {
      tag[kategorie] = tag[kategorie].filter((id) => {
        const bild = quelle[id];
        const ok = typeof bild === "string" && bild.startsWith("data:image/") && bild.length <= FOTO_MAX_LAENGE;
        if (ok) sauber[id] = bild;
        return ok;
      });
      if (tag[kategorie].length === 0) delete tag[kategorie];
    }
    if (Object.keys(tag).length === 0) delete neueDaten.fotos[schluessel];
  }
  return sauber;
}

function sicherungEinlesen(datei) {
  const leser = new FileReader();
  leser.onload = async () => {
    let roh = null;
    let neueDaten = null;
    try {
      roh = JSON.parse(leser.result);
      neueDaten = datenPruefen(roh);
    } catch (fehler) {
      neueDaten = null;
    }
    if (!neueDaten) {
      zeigeMeldung("Diese Datei ist keine gültige Sicherung. Es wurde nichts geändert.", "fehler");
      return;
    }
    const fotoDaten = fotoDatenPruefen(neueDaten, roh.fotoDaten);

    if (!confirm("Vorhandene Daten ersetzen?")) {
      zeigeMeldung("Einlesen abgebrochen. Es wurde nichts geändert.", "");
      return;
    }

    zeigeMeldung("Sicherung wird eingelesen …", "");
    try {
      await alleFotosErsetzen(fotoDaten);
    } catch (fehler) {
      zeigeMeldung("Die Fotos konnten nicht gespeichert werden. Es wurde nichts geändert.", "fehler");
      return;
    }

    const vorher = daten;
    daten = neueDaten;
    if (datenSpeichern()) {
      zeigeMeldung("Sicherung wurde eingelesen.", "ok");
      if (Object.keys(fotoDaten).length > 0) dauerhaftenSpeicherAnfragen();
    } else {
      daten = vorher;
    }
    wendeFarbenAn();
    allesAnzeigen();
  };
  leser.onerror = () => {
    zeigeMeldung("Die Datei konnte nicht gelesen werden. Es wurde nichts geändert.", "fehler");
  };
  leser.readAsText(datei);
}

// ---------- Start ----------

function start() {
  daten = datenLaden();

  document.getElementById("monatZurueck").addEventListener("click", () => {
    angezeigterMonat = new Date(angezeigterMonat.getFullYear(), angezeigterMonat.getMonth() - 1, 1);
    zeigeKalender();
  });
  document.getElementById("monatVor").addEventListener("click", () => {
    angezeigterMonat = new Date(angezeigterMonat.getFullYear(), angezeigterMonat.getMonth() + 1, 1);
    zeigeKalender();
  });
  document.getElementById("zuHeute").addEventListener("click", () => {
    angezeigterMonat = ersterTagDesMonats(new Date());
    zeigeKalender();
  });

  // Tagesansicht
  const tagDialog = document.getElementById("tagDialog");
  document.getElementById("tagFormular").addEventListener("submit", async (ereignis) => {
    ereignis.preventDefault(); // erst schließen, wenn das Speichern geklappt hat
    if (await speichereTag()) tagDialog.close();
  });
  document.getElementById("tagAbbrechen").addEventListener("click", () => tagDialog.close());
  tagDialog.addEventListener("close", () => {
    // Das "close"-Ereignis kommt etwas verzögert. Wurde inzwischen schon
    // ein anderer Tag geöffnet, darf dessen Entwurf nicht gelöscht werden.
    if (tagDialog.open) return;
    offenerTag = null;
    fotoEntwurf = {};
    fotoVorher = new Set();
    fotoNichtGeladen = {};
  });

  // Fotos bei Einträgen
  const fotoAuswahl = document.getElementById("fotoAuswahl");
  fotoAuswahl.addEventListener("change", () => {
    if (fotoAuswahl.files && fotoAuswahl.files.length > 0) fotosAusgewaehlt(fotoAuswahl.files);
  });
  const fotoDialog = document.getElementById("fotoDialog");
  document.getElementById("fotoSchliessen").addEventListener("click", () => fotoDialog.close());
  fotoDialog.addEventListener("close", () => { document.getElementById("fotoGross").removeAttribute("src"); });

  // Steckbrief
  const pferdDialog = document.getElementById("pferdDialog");
  document.getElementById("steckbriefBearbeiten").addEventListener("click", oeffneSteckbrief);
  document.getElementById("pferdFormular").addEventListener("submit", speichereSteckbrief);
  document.getElementById("pferdAbbrechen").addEventListener("click", () => pferdDialog.close());
  document.getElementById("eingabeName").addEventListener("input", zeigeBildVorschau);

  // Pferdebild
  const bildAuswahl = document.getElementById("bildAuswahl");
  document.getElementById("bildWaehlen").addEventListener("click", () => {
    bildAuswahl.value = "";
    bildAuswahl.click();
  });
  bildAuswahl.addEventListener("change", () => {
    if (bildAuswahl.files && bildAuswahl.files[0]) bildVerarbeiten(bildAuswahl.files[0]);
  });
  document.getElementById("bildEntfernen").addEventListener("click", () => {
    bildEntwurf = "";
    zeigeBildVorschau();
  });

  // Farben
  const farbDialog = document.getElementById("farbDialog");
  document.getElementById("farbenAendern").addEventListener("click", oeffneFarben);
  document.getElementById("farbenStandard").addEventListener("click", farbenAufStandard);
  document.getElementById("farbFormular").addEventListener("submit", speichereFarben);
  document.getElementById("farbAbbrechen").addEventListener("click", () => farbDialog.close());

  // Sicherung
  const dateiAuswahl = document.getElementById("dateiAuswahl");
  document.getElementById("sicherungLaden").addEventListener("click", sicherungHerunterladen);
  document.getElementById("sicherungEinlesen").addEventListener("click", () => {
    dateiAuswahl.value = "";
    dateiAuswahl.click();
  });
  dateiAuswahl.addEventListener("change", () => {
    if (dateiAuswahl.files && dateiAuswahl.files[0]) sicherungEinlesen(dateiAuswahl.files[0]);
  });

  wendeFarbenAn();
  zeigeLegende();
  allesAnzeigen();
  offlineHelferStarten();
}

// Startet den Offline-Helfer (sw.js). Das klappt nur, wenn die App
// über eine Internet-Adresse (https) geöffnet wird, nicht als Datei.
function offlineHelferStarten() {
  if (!("serviceWorker" in navigator)) return;
  if (location.protocol !== "https:" && location.hostname !== "localhost") return;
  navigator.serviceWorker.register("sw.js").catch(() => {
    // Ohne Offline-Helfer funktioniert die App trotzdem, nur nicht offline.
  });
}

start();
