# Deploy JSON Generator

Deploy JSON Generator to aplikacja webowa uruchamiana na IIS, która pozwala budować pliki JSON do deployu na podstawie diagramu zaleznosci miedzy buildami TeamCity. Projekt laczy dwa tryby pracy:

- `Flow Editor` do budowy pelnych plikow deploy JSON
- `External` do szybkiego generowania JSON z `externa: 1`

README jest glowna dokumentacja projektu dla uzytkownika i developera.

## 1. Zakres funkcjonalny

Aplikacja obsluguje:

- wiele flow na serwer
- trzy konteksty serwerowe: `haaTeamCity`, `teamcity`, `ferryt`
- wizualne zaleznosci `waitfor` miedzy buildami
- zaleznosci miedzy plikami JSON
- podglad JSON na zywo
- eksport pojedynczego pliku i paczki wszystkich plikow
- szybkie dodawanie buildow z listy
- tryb `External`
- buildy specjalne `TC_SQL` i `TC_PowerShell`
- katalog buildow Ferryt wraz z walidacja paczek w Artifactory
- automatyczny zapis stanu w `localStorage`
- izolacje danych per zalogowany uzytkownik IIS przez `whoami.aspx`

## 2. Szybki start dla uzytkownika

1. Otworz aplikacje w IIS.
2. Wybierz serwer TeamCity.
3. Ustaw nazwe pliku JSON i parametry flow.
4. Dodaj buildy recznie albo przez `Szybkie buildy`.
5. Polacz node'y, aby ustawic `waitfor`.
6. Sprawdz podglad JSON po prawej.
7. Pobierz jeden plik albo wszystkie pliki.

## 3. Tryby pracy

### Flow Editor

To podstawowy tryb budowy flow. Kazdy flow odpowiada jednemu plikowi JSON.

Najwazniejsze elementy:

- zakladki serwerow
- zakladki flow
- formularz ustawien flow
- diagram buildow
- lista zaleznosci miedzy plikami JSON
- podglad pojedynczego JSON
- lista wszystkich plikow JSON

### External

Tryb `External` generuje JSON z lista buildow, gdzie dla kazdego wpisu ustawiane jest:

```json
{
  "enabled": 1,
  "buildid": "BUILD_ID",
  "externa": 1
}
```

## 4. Obslugiwane serwery

Mapowanie serwerow jest zaszyte w `app.js`:

- `haaTeamCity` -> `https://haateamcity.mbank.pl/`
- `teamcity` -> `https://teamcity.mbank.pl/`
- `ferryt` -> `https://teamcity.mbank.pl/`

Serwer Ferryt ma dodatkowe domyslne wartosci flow:

- `runat: 21:00`
- `email: hardcore@mbank.pl`
- `blackout: "1680|Ferryt","1696|BPM ServicePoint"`

## 5. Praca z flow

Kazdy flow przechowuje:

- `filename`
- `enabled`
- `runat`
- `email`
- `blackout`
- `sms`
- `change`
- `nodes`
- `connections`
- `interflowWaitfor`

Wazne zasady:

- flow sa rozdzielone per serwer
- usuniecie flow usuwa tez referencje `interflowWaitfor`
- `waitfor` na poziomie flow jest wyliczany z zaznaczonych zaleznosci miedzy plikami

## 6. Praca z buildami na diagramie

Node zawiera m.in.:

- `name` - klucz w `builds`
- `buildid`
- `enabled`
- `waitfor`
- `retry`
- `external`
- `stop`
- `runnerType`
- `ferrytType`
- `params`

Zaleznosci miedzy buildami ustawia sie przez przeciagniecie polaczenia z jednego node'a na drugi. Node docelowy otrzymuje `waitfor` wskazujacy nazwe poprzedniego builda.

## 7. Szybkie buildy

Panel `Szybkie buildy` sluzy do masowego dodawania node'ow do aktywnego flow.

Akceptowane wejscie:

- samo `BUILD_ID`
- pelny link TeamCity z segmentem `buildConfiguration`
- pelny link TeamCity z koncowka `#all-projects`
- wariant z literowka `buildConfiguradion`, jesli taki link zostal skopiowany

Przyklad:

```text
Build_Deploy_App1
https://teamcity.mbank.pl/buildConfiguration/Build_Deploy_App2
https://teamcity.mbank.pl/buildConfiguration/Build_Deploy_App3#all-projects
```

Zasady:

- parser wycina tylko segment po `buildConfiguration`
- duplikaty na liscie sa blokowane
- konflikt nazwy z istniejacym node'em powoduje automatyczne dodanie sufiksu `_2`, `_3`, ...
- `name` i `buildid` sa ustawiane na znormalizowany `BUILD_ID`

## 8. Tryb External

Pole listy buildow dziala na tej samej zasadzie co `Szybkie buildy`.

Tryb generuje obiekt:

```json
{
  "tcserver": "https://haateamcity.mbank.pl/",
  "enabled": 1,
  "runat": "18:00",
  "waitfor": "",
  "builds": {
    "BUILD_ID": {
      "enabled": 1,
      "buildid": "BUILD_ID",
      "externa": 1
    }
  }
}
```

## 9. Buildy specjalne `TC_SQL` i `TC_PowerShell`

Specjalne typy buildow:

- `TC_SQL`
- `TC_PowerShell`

Rozpoznanie jest case-insensitive.

### TC_SQL

Wymagane pola:

- `sqlserver`
- `database`
- `file`

### TC_PowerShell

Wymagane pola:

- `servers`
- `file`

Aktualne zachowanie:

- buildy tego typu moga miec zduplikowany `buildid`
- wymagane pola sa walidowane przy zapisie
- jesli nowy node parametryczny zostanie zamkniety przez `X` lub `Esc` bez zapisu, jest usuwany z diagramu
- do JSON trafia tylko wypelnione `params`

Przyklad:

```json
"params": {
  "sqlserver": "SQLSERVER01",
  "database": "MyDatabase",
  "file": "script.sql"
}
```

## 10. Buildy Ferryt

Dla serwera `ferryt` aplikacja udostepnia dedykowany toolbar buildow:

- `SQL`
- `SVAutoImport`
- `Restart serwisow`
- `BPM`
- `Renew`

Buildy Ferryt korzystaja z `ferrytType` i zestawu pol `params` zdefiniowanego w `FERRYT_BUILD_CATALOG`.

### Typy Renew

`Renew` rozwija sie do jednego z typow:

- `RenewApplication File`
- `RenewApplication SQL`
- `RenewApplication Scenario`

### Walidacja Artifactory

Przycisk `Validate`:

- zbiera buildy Ferryt, ktore wymagaja sprawdzenia paczek
- wysyla POST do `validate-artifactory.aspx`
- pokazuje znalezione, brakujace i pominiete paczki

Walidacja nie dotyczy typow, ktore nie maja `artifactoryFolder` i `packageField`.

## 11. Generowanie JSON

Glowna funkcja to `generateJson(flow)` w `app.js`.

Zasady generacji:

- `tcserver` wynika z aktywnego serwera
- `enabled` jest brany z flow
- `waitfor` na poziomie flow pochodzi z `interflowWaitfor`
- `builds` sa generowane z uporzadkowanej listy node'ow
- `params` sa dolaczane tylko, gdy po sanitizacji pozostaja niepuste

Przykladowy wynik:

```json
{
  "tcserver": "https://haateamcity.mbank.pl/",
  "enabled": 1,
  "runat": "18:00",
  "builds": {
    "Deploy_Api": {
      "enabled": 1,
      "buildid": "Deploy_Api"
    },
    "Run_SQL": {
      "waitfor": "Deploy_Api",
      "enabled": 1,
      "buildid": "TC_SQL",
      "params": {
        "sqlserver": "SQLSERVER01",
        "database": "CoreDb",
        "file": "deploy.sql"
      }
    }
  }
}
```

## 12. Autozapis i dane lokalne

Stan jest zapisywany w `localStorage` co 5 sekund oraz po akcjach opakowanych przez `withSave(...)`.

Klucz:

- `deployJsonGenerator`
- albo `deployJsonGenerator_<DOMAIN\\user>` jesli `whoami.aspx` zwroci uzytkownika

To oznacza:

- odswiezenie strony przywraca flow
- dane jednego uzytkownika nie nadpisuja danych innego, jesli IIS zwraca tozsamosc

## 13. Skroty i zachowanie UI

- `Esc` zamyka modal edycji builda
- `Esc` zamyka drawer szybkich buildow
- `Esc` zamyka modal walidacji
- `Delete` usuwa aktualnie edytowany build

## 14. Struktura projektu

Najwazniejsze pliki:

- `index.html` - UI
- `styles.css` - style
- `app.js` - logika klienta
- `validate-artifactory.aspx` - backend walidacji Artifactory
- `whoami.aspx` - endpoint identyfikacji uzytkownika
- `web.config` - konfiguracja IIS
- `Resolve-ArtifactoryKeePass.ps1` - pobieranie hasla z KeePassVault
- `App_Data/artifactory.config.json` - konfiguracja Artifactory

## 15. Architektura techniczna

### Frontend

Stack:

- HTML
- CSS
- vanilla JavaScript

Frontend odpowiada za:

- zarzadzanie stanem aplikacji
- render flow i node'ow
- topologiczne porzadkowanie buildow
- generacje JSON
- obsluge `localStorage`
- walidacje formularzy

### Backend IIS

Projekt nie ma klasycznego backendu aplikacyjnego. Zamiast tego sa dwa lekkie endpointy ASP.NET Web Forms:

- `whoami.aspx`
- `validate-artifactory.aspx`

## 16. Endpoint `whoami.aspx`

Cel:

- zwraca nazwe aktualnego uzytkownika IIS w JSON

Przyklad odpowiedzi:

```json
{
  "username": "DOMAIN\\user"
}
```

Jest to wykorzystywane do separacji danych w `localStorage`.

## 17. Endpoint `validate-artifactory.aspx`

Cel:

- sprawdza, czy paczki dla buildow Ferryt sa widoczne w Artifactory

Metoda:

- tylko `POST`

Przyklad request:

```json
{
  "flowName": "ferryt_deploy_1",
  "change": "CHG123456",
  "packages": [
    {
      "nodeName": "SQL",
      "buildType": "SQL",
      "folder": "sql",
      "package": "package.zip"
    }
  ]
}
```

Przyklad response:

```json
{
  "ok": true,
  "found": [],
  "missing": [],
  "skipped": []
}
```

Szczegoly techniczne:

- odpowiedzi bledow IIS sa przepuszczane do klienta
- endpoint ustawia `Response.TrySkipIisCustomErrors = true`
- polaczenie z Artifactory odbywa sie po Basic Auth
- obsluga protokolu wymusza TLS 1.2

## 18. Konfiguracja Artifactory

Konfiguracja jest czytana z:

- `App_Data/artifactory.config.json`

Obslugiwane pola:

- `authMode`
- `baseUrl`
- `artifactoryUser`
- `username`
- `password`
- `keePassScriptPath`
- `keePassCredentialTitle`
- `keePassUsernameOverride`

W praktyce kod korzysta z:

- `baseUrl`
- `username`
- `password`
- `artifactoryUser`
- `keePassCredentialTitle`
- `keePassUsernameOverride`

Jesli `authMode` wskazuje KeePass albo haslo jest puste, endpoint probuje pobrac haslo przez `Resolve-ArtifactoryKeePass.ps1`.

Przykladowa konfiguracja:

```json
{
  "authMode": "KeePassVault",
  "baseUrl": "https://artifactory.example.local/artifactory/repo-name",
  "artifactoryUser": "ARTIFACTORY_PROD",
  "username": "svc_artifactory",
  "password": "",
  "keePassCredentialTitle": "ARTIFACTORY_PROD",
  "keePassUsernameOverride": ""
}
```

## 19. KeePassVault

Skrypt `Resolve-ArtifactoryKeePass.ps1`:

- znajduje `KeePassVaultAPI.ps1` w repo nadrzednym
- pobiera dane po `CredentialTitle`
- zwraca JSON z `username` i `password`

Warunki poprawnego dzialania:

- `KeePassVaultAPI.ps1` musi istniec w oczekiwanej lokalizacji
- proces IIS musi miec mozliwosc uruchomienia `powershell.exe`
- konto aplikacyjne musi miec dostep do zrodla danych KeePassVault

## 20. Konfiguracja IIS

`web.config` ustawia m.in.:

- `customErrors mode="Off"`
- `httpErrors existingResponse="PassThrough"`
- MIME dla `.json`, `.woff`, `.woff2`
- `index.html` jako default document
- naglowki:
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: SAMEORIGIN`
  - `X-XSS-Protection: 1; mode=block`

## 21. Rozszerzanie aplikacji

### Dodanie nowego pola do node'a

Najczestsze miejsca zmian:

- formularz w `index.html`
- `openNodeModal()`
- `saveNodeEdit()`
- `generateJson(flow)`

### Zmiana rozpoznawania buildow specjalnych

Kluczowe funkcje:

- `isTcSql(buildId)`
- `isTcPowerShell(buildId)`

Jesli chcesz zmienic nazwy rozpoznawanych buildow, zacznij od tych helperow.

### Dodanie nowego typu Ferryt

Zmien:

- `FERRYT_BUILD_CATALOG`
- opcjonalnie `FERRYT_TOOLBAR_ITEMS`
- jesli dotyczy `Renew`, to rowniez `FERRYT_RENEW_TYPES`

### Rozbudowa walidacji

Punkty wejscia:

- walidacje formularza w `saveNodeEdit()`
- parser danych Ferryt w `getFerrytParamsFromInputs()`
- walidator endpointu w `validate-artifactory.aspx`

## 22. Utrzymanie i testy reczne

Minimum po zmianach:

1. Dodanie zwyklego builda i zapis JSON.
2. Dodanie zaleznosci miedzy buildami.
3. Dodanie zaleznosci miedzy plikami JSON.
4. Test `Szybkich buildow` dla:
   - zwyklej nazwy
   - pelnego linku TeamCity
   - linku z `#all-projects`
5. Test `External` dla tych samych wariantow wejscia.
6. Test `TC_SQL` i `TC_PowerShell`:
   - walidacja pol
   - zamkniecie przez `X` bez zapisu
   - obecnosci `params` w JSON
7. Test Ferryt:
   - dodanie builda z toolbaru
   - walidacja wymaganych pol
   - `Validate` do Artifactory
8. Odswiezenie strony i sprawdzenie `localStorage`.

## 23. Najczestsze problemy

### Puste buildy specjalne zostaja na diagramie

Aktualna logika usuwa nowy node parametryczny po zamknieciu modala bez zapisu. Jesli problem wraca, sprawdz zmiany wokol:

- `pendingNewNodeId`
- `closeNodeModal()`
- `nodeRequiresCompletedParams()`

### W `Szybkich buildach` albo `External` zapisuje sie pelny link zamiast `buildid`

Parser wejscia jest w:

- `extractBuildIdFromInput(value)`
- `parseBuildListInput(value)`

To tam nalezy poprawiac logike normalizacji linkow TeamCity.

### Walidacja Artifactory zwraca bledy HTML zamiast JSON

Frontend probuje zamienic taka odpowiedz na czytelny komunikat. Jesli nadal widzisz problem, sprawdz:

- `web.config`
- `validate-artifactory.aspx`
- dostepnosc `App_Data/artifactory.config.json`

## 24. Autorstwo

Footer aplikacji wskazuje:

- `(c) 2026 DEI-ZUK-C | L.Peryt`

## 25. Pliki historyczne

W repo nadal moga istniec starsze pliki dokumentacyjne:

- `INSTRUKCJA_UZYTKOWNIKA.md`
- `DOKUMENTACJA_TECHNICZNA.md`
- `DOKUMENTACJA_BUILDID_TC.md`

Kanoniczna dokumentacja projektu znajduje sie w tym pliku i w `CHANGELOG.md`.
