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

// Das Pferdebild wird auf diese Größe (in Pixeln) verkleinert,
// damit es in den Browser-Speicher passt.
const BILD_GROESSE = 240;
const BILD_MAX_LAENGE = 1000000; // höchstens ca. 1 MB Text

function leereDaten() {
  return {
    version: 1,
    pferd: { name: "", rasse: "", geburtsjahr: null, bild: "" },
    farben: {},
    tage: {},
  };
}

let daten = leereDaten();
let angezeigterMonat = ersterTagDesMonats(new Date());
let offenerTag = null; // Datum-Schlüssel des geöffneten Tages
let bildEntwurf = ""; // Bild im Steckbrief-Dialog, bevor man speichert

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
  const kommende = Object.keys(daten.tage)
    .filter((schluessel) => schluessel >= heute && daten.tage[schluessel][kategorie])
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
    const eintraege = daten.tage[schluessel] || {};

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
      if (eintraege[kategorie.schluessel]) {
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

function oeffneTag(schluessel) {
  offenerTag = schluessel;
  const datum = schluesselZuDatum(schluessel);
  document.getElementById("tagTitel").textContent =
    datum.toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  const eintraege = daten.tage[schluessel] || {};
  const felder = document.getElementById("tagFelder");
  felder.replaceChildren();

  for (const kategorie of KATEGORIEN) {
    const label = document.createElement("label");
    label.className = "feld";

    const kopf = document.createElement("span");
    kopf.className = "feld-kopf";
    const punkt = document.createElement("span");
    punkt.className = "punkt";
    punkt.style.setProperty("--farbe", "var(--" + kategorie.schluessel + ")");
    kopf.appendChild(punkt);
    kopf.appendChild(document.createTextNode(kategorie.name));

    const textfeld = document.createElement("textarea");
    textfeld.name = kategorie.schluessel;
    textfeld.rows = 2;
    textfeld.value = eintraege[kategorie.schluessel] || "";

    label.appendChild(kopf);
    label.appendChild(textfeld);
    felder.appendChild(label);
  }

  document.getElementById("tagDialog").showModal();
}

function speichereTag() {
  if (!offenerTag) return;
  const felder = document.querySelectorAll("#tagFelder textarea");
  const tag = {};
  felder.forEach((feld) => {
    const text = feld.value.trim();
    if (text !== "") tag[feld.name] = text;
  });

  if (Object.keys(tag).length > 0) {
    daten.tage[offenerTag] = tag;
  } else {
    delete daten.tage[offenerTag];
  }
  datenSpeichern();
  offenerTag = null;
  allesAnzeigen();
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

// Liest ein Bild ein, schneidet es quadratisch zu und verkleinert es.
function bildVerarbeiten(datei) {
  const meldung = document.getElementById("bildMeldung");
  meldung.className = "meldung";
  meldung.textContent = "Bild wird geladen …";

  const adresse = URL.createObjectURL(datei);
  const bild = new Image();
  bild.onload = () => {
    const seite = Math.min(bild.naturalWidth, bild.naturalHeight);
    const x = (bild.naturalWidth - seite) / 2;
    const y = (bild.naturalHeight - seite) / 2;

    const leinwand = document.createElement("canvas");
    leinwand.width = BILD_GROESSE;
    leinwand.height = BILD_GROESSE;
    const malen = leinwand.getContext("2d");
    malen.fillStyle = "#ffffff";
    malen.fillRect(0, 0, BILD_GROESSE, BILD_GROESSE);
    malen.drawImage(bild, x, y, seite, seite, 0, 0, BILD_GROESSE, BILD_GROESSE);
    URL.revokeObjectURL(adresse);

    bildEntwurf = leinwand.toDataURL("image/jpeg", 0.85);
    meldung.textContent = "";
    zeigeBildVorschau();
  };
  bild.onerror = () => {
    URL.revokeObjectURL(adresse);
    meldung.className = "meldung fehler";
    meldung.textContent = "Dieses Bild konnte nicht geöffnet werden. Versuche ein JPG- oder PNG-Bild.";
  };
  bild.src = adresse;
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

function sicherungHerunterladen() {
  const inhalt = JSON.stringify(daten, null, 2);
  const datei = new Blob([inhalt], { type: "application/json" });
  const adresse = URL.createObjectURL(datei);
  const link = document.createElement("a");
  link.href = adresse;
  link.download = "pferd-sicherung.json";
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(adresse), 1000);
  zeigeMeldung("Sicherung wurde heruntergeladen.", "ok");
}

function sicherungEinlesen(datei) {
  const leser = new FileReader();
  leser.onload = () => {
    let neueDaten = null;
    try {
      neueDaten = datenPruefen(JSON.parse(leser.result));
    } catch (fehler) {
      neueDaten = null;
    }
    if (!neueDaten) {
      zeigeMeldung("Diese Datei ist keine gültige Sicherung. Es wurde nichts geändert.", "fehler");
      return;
    }
    if (!confirm("Vorhandene Daten ersetzen?")) {
      zeigeMeldung("Einlesen abgebrochen. Es wurde nichts geändert.", "");
      return;
    }
    daten = neueDaten;
    if (datenSpeichern()) zeigeMeldung("Sicherung wurde eingelesen.", "ok");
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
  document.getElementById("tagFormular").addEventListener("submit", speichereTag);
  document.getElementById("tagAbbrechen").addEventListener("click", () => tagDialog.close());
  tagDialog.addEventListener("close", () => { offenerTag = null; });

  // Steckbrief
  const pferdDialog = document.getElementById("pferdDialog");
  document.getElementById("steckbriefBearbeiten").addEventListener("click", oeffneSteckbrief);
  document.getElementById("pferdFormular").addEventListener("submit", speichereSteckbrief);
  document.getElementById("pferdAbbrechen").addEventListener("click", () => pferdDialog.close());
  document.getElementById("eingabeName").addEventListener("input", zeigeBildVorschau);

  // Bild
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
}

start();
