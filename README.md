# KeyKeeper 🔐

Un gestore sicuro di API keys costruito con Tauri v2, Next.js, TypeScript e Rust. Stile family.co con animazioni fluide tramite Framer Motion.

## 🚀 Caratteristiche

- **Sicurezza Locale**: Tutte le API keys sono memorizzate localmente sul tuo dispositivo
- **Crittografia**: Password master per proteggere il vault
- **Organizzazione**: Gestisci keys per diversi ambienti (dev, staging, production)
- **Ricerca Avanzata**: Trova rapidamente le tue API keys
- **Scadenze**: Monitora le date di scadenza delle keys
- **Tags e Scopes**: Organizza le keys con tag e scopes personalizzati
- **Export**: Esporta il vault per backup
- **UI Moderna**: Interfaccia ispirata a family.co con animazioni fluide

## 🛠️ Tecnologie

- **Frontend**: Next.js 14, TypeScript, Tailwind CSS, Framer Motion
- **Backend**: Rust con Tauri v2
- **State Management**: Zustand
- **Icons**: Lucide React
- **Package Manager**: Yarn

## 📦 Installazione

### Prerequisiti

- Node.js 18+
- Rust 1.77+ (per Tauri v2)
- Yarn

### Setup

1. **Installa le dipendenze**
   ```bash
   yarn install
   ```

2. **Installa Tauri CLI v2**
   ```bash
   yarn add -D @tauri-apps/cli@^2.0.0
   ```

3. **Avvia in modalità sviluppo**
   ```bash
   yarn tauri:dev
   ```

4. **Build per produzione**
   ```bash
   yarn tauri:build
   ```

## 🎯 Utilizzo

### Primo Avvio

1. Al primo avvio, imposta una password master sicura
2. Questa password verrà usata per crittografare il vault
3. **Non dimenticare la password**: non c'è modo di recuperarla!

### Gestione API Keys

1. **Aggiungi una nuova API key**:
   - Clicca su "Nuova API Key"
   - Compila i campi obbligatori (Nome, Servizio, API Key)
   - Seleziona l'ambiente (dev/staging/production)
   - Aggiungi descrizione, scopes e tags opzionali

2. **Modifica una key esistente**:
   - Seleziona la key dalla lista
   - Clicca sull'icona di modifica
   - Aggiorna i campi necessari

3. **Elimina una key**:
   - Seleziona la key
   - Clicca sull'icona elimina
   - Conferma l'eliminazione

### Ricerca e Filtri

- Usa la barra di ricerca per trovare keys per nome, servizio o tag
- Le keys sono organizzate per ambiente con contatori colorati
- Visualizza facilmente le keys in scadenza

### Sicurezza

- **Blocca il vault**: Usa il pulsante "Blocca Vault" per proteggere i dati
- **Nascondi/Mostra keys**: Usa gli occhi per mostrare/nascondere le API keys
- **Copia sicura**: Copia le keys negli appunti con un click

## 🔧 Configurazione

### Personalizzazione UI

Modifica `tailwind.config.js` per personalizzare:
- Colori del tema
- Animazioni
- Spaziature

### Sicurezza Aggiuntiva

⚠️ **Importante**: Questa è una demo. Per uso in produzione:

1. Sostituisci `simple_hash()` in `main.rs` con un hash sicuro (bcrypt/argon2)
2. Implementa crittografia vera per il vault
3. Aggiungi backup automatici
4. Implementa password recovery sicura

## 📁 Struttura Progetto

```
keykeeper/
├── components/           # Componenti React
│   ├── modals/          # Modali per CRUD
│   ├── LoginScreen.tsx  # Schermata login
│   ├── MainLayout.tsx   # Layout principale
│   ├── Sidebar.tsx      # Sidebar navigazione
│   ├── ApiKeyList.tsx   # Lista API keys
│   └── ApiKeyDetail.tsx # Dettaglio singola key
├── lib/
│   ├── store.ts         # Zustand store
│   └── utils.ts         # Funzioni utility
├── pages/
│   ├── _app.tsx         # App Next.js
│   └── index.tsx        # Homepage
├── src-tauri/
│   ├── capabilities/    # Capabilities Tauri v2
│   ├── src/
│   │   └── main.rs      # Backend Rust
│   ├── Cargo.toml       # Dipendenze Rust
│   └── tauri.conf.json  # Configurazione Tauri v2
├── styles/
│   └── globals.css      # Stili globali
└── package.json         # Dipendenze Node.js
```

## 🆕 Novità Tauri v2

Questo progetto è aggiornato per Tauri v2 con:

### 🔧 Miglioramenti Tecnici
- **Plugin System**: Modularità migliorata con plugin separati
- **Capabilities**: Nuovo sistema di permessi più sicuro
- **Performance**: Startup e runtime più veloci
- **API Migliorate**: API più intuitive e consistenti

### 🚀 Nuove Funzionalità
- **Sicurezza Migliorata**: Controllo granulare dei permessi
- **Bundle Ottimizzati**: Dimensioni ridotte dell'applicazione
- **Cross-Platform**: Supporto migliorato per tutte le piattaforme
- **Developer Experience**: Debugging e sviluppo più semplici

### 🔄 Migrazione da v1
- Configurazione aggiornata in `tauri.conf.json`
- Nuove API nei plugin separati
- Sistema di capabilities per permessi
- Gestione migliorata delle dipendenze

## 🎨 Stile e Design

L'interfaccia è ispirata a [family.co](https://family.co) con:
- Palette colori moderna e professionale
- Animazioni fluide con Framer Motion
- Layout responsive e accessibile
- Micro-interazioni per un'esperienza premium

## 🔒 Sicurezza

- **Archiviazione locale**: I dati non lasciano mai il tuo dispositivo
- **Crittografia master**: Password unica per proteggere il vault
- **Permessi granulari**: Controllo preciso delle capabilities
- **Backup sicuro**: Esporta il vault in formato JSON

## 🤝 Contribuire

1. Fork il progetto
2. Crea un branch per la feature (`git checkout -b feature/AmazingFeature`)
3. Commit le modifiche (`git commit -m 'Add some AmazingFeature'`)
4. Push al branch (`git push origin feature/AmazingFeature`)
5. Apri una Pull Request

## 📝 Script Disponibili

- `yarn tauri:dev` - Avvia in modalità sviluppo
- `yarn tauri:build` - Build per produzione
- `yarn dev` - Solo frontend Next.js
- `yarn build` - Build Next.js
- `yarn lint` - Controlla il codice con ESLint
- `yarn format` - Formatta il codice con Prettier

## 🐛 Problemi Noti

- Le icone Tauri devono essere generate manualmente
- Il sistema di crittografia è basilare (solo per demo)
- Non c'è recupero password (password persa = vault perso)

## 🔮 Roadmap

- [ ] Crittografia AES-256 vera
- [ ] Backup automatici
- [ ] Importazione da 1Password/Bitwarden
- [ ] Sincronizzazione cloud opzionale
- [ ] Plugin per browser
- [ ] Tema scuro
- [ ] Supporto multi-vault

## 📄 Licenza

Distribuito sotto licenza MIT. Vedi `LICENSE` per maggiori informazioni.

## 🙏 Ringraziamenti

- [Tauri](https://tauri.app/) per il framework
- [Next.js](https://nextjs.org/) per il frontend
- [Framer Motion](https://www.framer.com/motion/) per le animazioni
- [family.co](https://family.co/) per l'ispirazione del design
- [Lucide](https://lucide.dev/) per le icone

---

Made with ❤️ by developers, for developers