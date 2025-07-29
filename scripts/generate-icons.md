# Generazione Icone per KeyKeeper

Per completare l'app, dovrai generare le icone necessarie per Tauri.

## Icone Richieste

Le icone devono essere posizionate in `src-tauri/icons/`:

- `32x32.png` - Icona piccola
- `128x128.png` - Icona media
- `128x128@2x.png` - Icona media retina
- `icon.icns` - Icona macOS
- `icon.ico` - Icona Windows

## Come Generare le Icone

### Metodo 1: Tauri Icon Generator (Consigliato)

1. **Crea un'icona base** (1024x1024 PNG) con design KeyKeeper:
   - Usa un lucchetto o una chiave come simbolo principale
   - Colori: blu (#0ea5e9) come colore principale
   - Stile minimale e professionale

2. **Genera tutte le icone**:
   ```bash
   yarn tauri icon path/to/your/icon.png
   ```

### Metodo 2: Manuale

Crea manualmente le icone con le seguenti specifiche:

#### Design Guidelines
- **Simbolo**: Chiave o lucchetto stilizzato
- **Colori**: 
  - Primario: #0ea5e9 (accent-600)
  - Secondario: #334155 (primary-700)
  - Sfondo: Bianco o trasparente
- **Stile**: Moderno, minimale, professionale

#### Specifiche Tecniche
- **Formato**: PNG con trasparenza
- **Qualità**: Alta risoluzione
- **Consistenza**: Stesso design per tutte le dimensioni

## Esempio di Design

```
┌─────────────────┐
│                 │
│     🔐         │
│   KeyKeeper     │
│                 │
└─────────────────┘
```

## Posizionamento File

```
src-tauri/
└── icons/
    ├── 32x32.png
    ├── 128x128.png
    ├── 128x128@2x.png
    ├── icon.icns
    └── icon.ico
```

## Verifica

Dopo aver generato le icone:

1. Controlla che tutti i file siano presenti
2. Verifica che le icone si visualizzino correttamente
3. Testa su diversi sistemi operativi

## Risorse Utili

- [Tauri Icon Documentation](https://tauri.app/v1/guides/features/icons)
- [Icon Design Guidelines](https://developer.apple.com/design/human-interface-guidelines/icons)
- [Figma Template](https://www.figma.com/community/file/icon-template)

## Note

- Le icone sono fondamentali per la distribuzione dell'app
- Assicurati che rispettino le linee guida della piattaforma
- Testa sempre su dispositivi reali prima del rilascio