# LexiFlow Study Hub

Crea una web app full-stack in React (con Vite, Tailwind CSS, TypeScript e Lucide Icons) dal design estremamente rifinito, pulito, impeccabile e pixel-perfect (stile "preppy, clean vintage" con palette neutra, toni caldi e transizioni fluide). L'applicazione si chiama "LexiFlow Study Hub" ed è pensata per essere perfetta sia su desktop che su dispositivi mobili. L'architettura deve essere solida, senza errori di build e priva di schermate di errore grezze.

### 1. Flusso di Onboarding Iniziale e Profilazione Rigorosa (Obbligatorio)
Al primo accesso, l'utente attraversa un onboarding sequenziale guidato strutturato nei seguenti step precisi:
- **Step 1 (Lingua & Livello CEFR):** Selezione della lingua nativa e scelta obbligatoria del livello di inglese basata sugli standard europei ufficiali: `A1`, `A2`, `B1`, `B2`. Questo dato deve essere fondamentale per calibrare la difficoltà dei contenuti.
- **Step 2 (Obiettivo & Certificazioni Ufficiali):** L'utente seleziona il proprio obiettivo specifico di studio, con opzioni dedicate per la preparazione di certificazioni internazionali: `Cambridge (FCE/CAE)`, `IELTS`, `TOEFL`, oppure `Inglese per Conversazione/Business`.
- **Step 3 (Frequenza di Studio):** L'utente specifica quanti giorni a settimana segue lezioni o desidera allenarsi, permettendo all'app di calcolare un piano di studio dinamico e una streak personalizzata.

### 2. Archivio Cronologico per Mese (Lezioni e Materiali)
- La libreria e lo spazio di studio devono organizzare automaticamente tutti i materiali, le lezioni e le schede salvate in una vista cronologica divisa per mesi (es. Novembre 2026, Dicembre 2026).

### 3. Caricamento Multimodale dei Materiali e Analisi AI (Core Features)
La funzionalità principale dell'app deve essere un modulo di upload estremamente intuitivo e flessibile per caricare le lezioni ricevute (schede, dispense, appunti):
- **Opzioni di caricamento:** L'utente deve poter scegliere tra **Scattare/Caricare una foto** (es. foto a dispense cartacee o lavagne), **Caricare un file** (PDF, immagini o documenti di testo) oppure **Inserire del testo digitato/a mano**.
- **Elaborazione AI:** L'intelligenza artificiale deve analizzare istantaneamente il contenuto multimediale caricato (foto, file o testo) per estrarre il vocabolario chiave e generare automaticamente schede di studio (*study cards*) mirate al livello selezionato (A1-B2) e all'esame da preparare (es. IELTS/Cambridge).

### 4. Sistema di Studio Dinamico, Active Recall & Ripetizione Spaziata (Stile Duolingo)
Durante le sessioni di ripasso giornaliero:
- **Active Recall & Spaced Repetition:** L'app traccia rigorosamente il numero di risposte corrette ed errate per ogni scheda di vocabolario o grammatica. Sulla base degli errori, l'algoritmo ripropone i concetti a intervalli intelligenti (più spesso gli elementi difficili, meno spesso quelli già acquisiti).
- **Input Multimodale per gli Esercizi:** Durante i test di verifica, l'utente può rispondere sia **digitando il testo** sia utilizzando la **registrazione vocale (audio)** per testare la pronuncia e l'espressione orale.
- **Streak & XP Giornalieri:** Sistema di gamification pulito per mantenere alta la motivazione basato sui giorni di studio consecutivi.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/efe2c234-961d-4cce-b1b0-980a6201696f).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
