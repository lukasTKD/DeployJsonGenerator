# Deploy JSON Generator — dokumentacja techniczna

## 1. Cel aplikacji
Aplikacja generuje pliki JSON dla procesów deploy i pozwala wizualnie budować zależności `waitfor` między buildami oraz między plikami JSON.

## 2. Architektura
- Frontend: czysty HTML/CSS/JavaScript
- Brak backendu aplikacyjnego (działanie w przeglądarce)
- Stan aplikacji trzymany w `localStorage`

Pliki:
- `index.html` — struktura UI
- `styles.css` — stylowanie i animacje
- `app.js` — logika biznesowa, flow, walidacje, generacja JSON

## 3. Struktura danych (stan)
W `app.js` aplikacja utrzymuje:
- `state.flows` — słownik flow (każdy flow to przyszły plik JSON)
- `state.flowOrder` — kolejność flow
- `state.currentFlowId` — aktywny flow
- `state.currentServer` — aktywny serwer TeamCity
- `nodes` i `connections` w ramach flow

Node (build) zawiera m.in.:
- `name`
- `buildid`
- `enabled`
- `waitfor`
- `retry`
- `external`
- `params` (tylko dla specjalnych buildów)

## 4. Specjalne buildy TC i params
Obsługiwane są 2 specjalne typy `buildid`:
- `TC_SQL`
- `TC_PowerShell`

Działanie:
- rozpoznanie jest **case-insensitive**,
- dla tych buildów dozwolone są duplikaty `buildid`,
- UI pokazuje dedykowane pola `params`,
- `params` trafiają do wygenerowanego JSON.

Funkcje kluczowe w `app.js`:
- `isTcSql(buildId)`
- `isTcPowerShell(buildId)`
- `updateTcParamsVisibility(buildId)`
- `saveTcParams(node)`
- `validateBuildId(flow, buildid, excludeNodeId)`

Schemat `params`:

Dla SQL:
```json
"params": {
  "sqlserver": "",
  "database": "",
  "file": ""
}
```

Dla PowerShell:
```json
"params": {
  "servers": "",
  "file": ""
}
```

## 5. Szybkie dodawanie buildów (drawer)
Sekcja „Szybkie dodawanie buildów” działa jako wysuwany panel z lewej.

Elementy:
- pionowy trigger z etykietą i strzałką,
- overlay,
- drawer z textarea i akcjami.

Funkcje:
- `toggleBulkDrawer()`
- `closeBulkDrawer()`
- `bulkAddBuilds()`

Zachowanie:
- po udanym dodaniu buildów drawer zamyka się automatycznie,
- `Esc` zamyka modal node i drawer,
- przy konflikcie nazw node nadawane są sufiksy `_2`, `_3`, ...

## 6. Generacja JSON
Funkcja `generateJson(flow)` buduje wynikowy obiekt.

Zasady:
- `tcserver` jest wybierany na podstawie aktywnego serwera,
- `waitfor` na poziomie flow jest budowany z zależności między plikami,
- `builds` powstają z node’ów po uporządkowaniu grafu,
- `params` są dokładane tylko gdy node je posiada.

## 7. UI/UX — ważne elementy
- Header: logo + animowana ikona JSON + tytuł
- Footer: wzór z `prodHealtchCheck` (logo + tekst)
- `Podgląd JSON`: przewija się razem z treścią (bez sticky)
- Favicon: odnośnik w `<head>` wskazuje `images/favicon.png`

## 8. Trwałość danych
`saveState()` i `loadState()` zapisują/odczytują stan z `localStorage` (`deployJsonGenerator`).

Migracje w kodzie:
- konwersja starych formatów `interflowWaitfor` na tablicę.

## 9. Punkty rozszerzeń
Najbezpieczniej rozszerzać przez:
- nowe pola node w `openNodeModal()` / `saveNodeEdit()` / `generateJson()`
- nowe walidacje w sekcji `VALIDATORS`
- nowe warianty `buildid` przez helpery podobne do `isTcSql/isTcPowerShell`

## 10. Utrzymanie
Po zmianach UI/logiki zalecane minimum:
- sprawdzenie edycji node i zapisu JSON,
- test bulk drawer (open/close, dodawanie, konflikt nazw),
- test trybu External,
- test persystencji po odświeżeniu strony.
