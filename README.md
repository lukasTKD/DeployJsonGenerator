# Deploy JSON Generator

Jeden kanoniczny plik dokumentacji projektu. Zawiera opis dla uzytkownika, informacje techniczne i skrocony changelog.

## 1. Do czego sluzy aplikacja

Aplikacja webowa uruchamiana na IIS sluzy do przygotowania i edycji plikow JSON do deployow:
- dodawania buildow,
- ustawiania zaleznosci miedzy buildami,
- ustawiania zaleznosci miedzy plikami JSON,
- zapisu plikow bezposrednio do katalogu deploya,
- wczytywania istniejacych plikow JSON z wybranej daty instalacji,
- walidacji paczek Ferryt w Artifactory.

## 2. Najwazniejsze funkcje

- trzy konteksty serwerowe: `haaTeamCity`, `teamcity`, `ferryt`
- wiele plikow JSON na serwer
- wizualne zaleznosci `waitfor` miedzy buildami
- zaleznosci miedzy plikami JSON
- podglad JSON na zywo
- `Szybkie buildy`
- runnery specjalne dla `haaTeamCity`
- dedykowany toolbar Ferryt
- logowanie aktywnosci uzytkownikow
- autozapis stanu do `localStorage`

## 3. Podstawowy workflow

1. Otworz aplikacje w IIS.
2. Wybierz serwer: `haaTeamCity.mbank.pl`, `TeamCity.mbank.pl` albo `Ferryt`.
3. Ustaw `Nazwe pliku JSON`, `Date instalacji` i pozostale parametry pliku.
4. Dodaj buildy:
   - recznie przyciskiem `+ Dodaj Build`,
   - przez panel `Szybkie buildy`,
   - albo przez przyciski runnerow dla `haaTeamCity`.
5. Ustaw zaleznosci miedzy buildami przez polaczenia na diagramie.
6. Ustaw zaleznosci miedzy plikami w sekcji `Zaleznosci miedzy plikami JSON`.
7. Zapisz jeden plik albo wszystkie pliki do katalogu deploya.

## 4. Data instalacji i katalog zapisu

- Pole `Data instalacji` steruje katalogiem docelowym zapisu.
- Pliki zapisywane sa do:
  `D:\PROD_REPO_DATA\AutomateDeploy\Deploys\YYYY-MM-DD`
- Przy zapisie aplikacja sprawdza, czy katalog dla tej daty istnieje.
- Jesli nie istnieje, katalog jest tworzony automatycznie.
- W sekcji `Wszystkie pliki JSON` wyswietlana jest aktualna pelna sciezka zapisu.

## 5. Wczytywanie istniejacych JSON-ow

- Przy `Data instalacji` uzyj przycisku `Wczytaj z daty`.
- Aplikacja odczyta pliki JSON z katalogu dla wybranej daty i zaladuje je do edytora.
- Wczytanie zastapi biezaca zawartosc edytora.
- Podczas importu odtwarzane sa:
  - buildy,
  - `waitfor` miedzy buildami,
  - zaleznosci miedzy plikami JSON.

## 6. Obslugiwane serwery

Mapowanie serwerow jest zaszyte w `app.js`:

- `haaTeamCity` -> `https://haateamcity.mbank.pl/`
- `teamcity` -> `https://teamcity.mbank.pl/`
- `ferryt` -> `https://teamcity.mbank.pl/`

Dla Ferryt ustawiane sa dodatkowe domyslne wartosci flow:
- `runat: 21:00`
- `email: hardcore@mbank.pl`
- `blackout: "1680|Ferryt","1696|BPM Service"`
- `filename: Ferryt_<change>`

## 7. Szybkie buildy

- Otworz panel `Szybkie buildy`.
- Wklej liste buildow lub pelne linki TeamCity, po jednym wpisie na linie.
- Kliknij `Dodaj buildy`.

Akceptowane wejscie:
- samo `BUILD_ID`
- pelny link TeamCity z segmentem `buildConfiguration`
- pelny link TeamCity zakonczony `#all-projects`
- wariant z literowka `buildConfiguradion`

Wazne:
- duplikaty na wklejonej liscie sa blokowane,
- konflikt nazw z istniejacymi node'ami jest rozwiazywany automatycznie przez dopisanie sufiksu,
- checkbox `external = 1` ustawia `external` dla wszystkich nowo dodanych buildow.

## 8. Buildy i zaleznosci

Node na diagramie zawiera m.in.:
- `name`
- `buildid`
- `enabled`
- `waitfor`
- `retry`
- `external`
- `stop`
- `runnerType`
- `ferrytType`
- `params`

### 8.1 Miedzy buildami

- przeciagnij polaczenie z jednego node'a na drugi,
- docelowy node dostanie `waitfor` wskazujacy poprzedni build.

### 8.2 Miedzy plikami JSON

- uzyj sekcji `Zaleznosci miedzy plikami JSON`,
- zaznacz, ktore pliki maja wykonac sie wczesniej.

## 9. Specjalne buildy runnerow

Dla `haaTeamCity` dostepne sa gotowe przyciski dodawania runnerow.

Aktualne `buildid`:
- `AutomateDeploy_SqlRunner`
- `AutomateDeploy_ScriptRunner`
- `AnsiblePlaybookRunner_ProdRunPlaybookAnsible`

Po ustawieniu odpowiedniego `buildid` pojawiaja sie dodatkowe pola `params`.

### 9.1 AutomateDeploy_SqlRunner

Wymagane pola:
- `sqlserver`
- `database`
- `file`

### 9.2 AutomateDeploy_ScriptRunner

Wymagane pola:
- `servers`
- `file`

### 9.3 AnsiblePlaybookRunner_ProdRunPlaybookAnsible

Dostepne pola:
- `inventory_path`
- `git.envbook.repo.branch`
- `playbook_path`

## 10. Buildy, ktore moga wystepowac wielokrotnie

Ponizsze `buildid` moga pojawic sie wielokrotnie w jednym pliku JSON:
- `AutomateDeploy_SqlRunner`
- `AutomateDeploy_ScriptRunner`
- `AnsiblePlaybookRunner_ProdRunPlaybookAnsible`

Pozostale `buildid` sa walidowane pod katem duplikatow w ramach jednego pliku.
Liste mozna edytowac bezposrednio w `app.js` w stalej `DUPLICATE_ALLOWED_BUILD_IDS`.

## 11. Ferryt

Dla serwera `ferryt` aplikacja udostepnia dedykowany toolbar buildow:
- `SQL`
- `SVAutoImport`
- `Restart serwisow`
- `BPM`
- `Renew`

`Renew` rozwija sie do:
- `RenewApplication File`
- `RenewApplication SQL`
- `RenewApplication Scenario`

Buildy Ferryt korzystaja z `ferrytType` i zestawu pol `params` zdefiniowanego w `FERRYT_BUILD_CATALOG`.

### Walidacja Artifactory

Przycisk `Validate`:
- zbiera buildy Ferryt wymagajace sprawdzenia paczek,
- wysyla `POST` do `validate-artifactory.aspx`,
- pokazuje znalezione, brakujace i pominiete paczki.

## 12. Zapisywanie

Masz dostepne trzy warianty zapisu:
- `Zapisz` w podgladzie aktualnego pliku,
- `Zapisz` przy konkretnym pliku na liscie `Wszystkie pliki JSON`,
- `Zapisz wszystko do Deploya`.

Przy zapisie logowane sa:
- uzytkownik z IIS,
- typ akcji,
- data instalacji,
- katalog docelowy,
- lista zapisanych plikow.

Model zapisu:
- frontend wysyla dane do `save-deploys.aspx`,
- `save-deploys.aspx` uruchamia `save-deploys.ps1` przez `powershell.exe`,
- skrypt PowerShell tworzy katalog daty i zapisuje pliki JSON.

## 13. Dostep do aplikacji

- Dostep do strony jest kontrolowany przez `Authorization Rules` w IIS.
- Uzytkownik bez dostepu zobaczy `access-denied.html`.
- Uprawniony uzytkownik nie widzi komunikatu o ograniczeniu dostepu na glownej stronie.

## 14. Autozapis i dane lokalne

Stan edytora zapisuje sie automatycznie w `localStorage`.

Klucz:
- `deployJsonGenerator`
- albo `deployJsonGenerator_<DOMAIN\\user>`, jesli `whoami.aspx` zwroci uzytkownika

To oznacza:
- odswiezenie strony przywraca lokalny stan,
- dane uzytkownikow sa separowane po loginie IIS.

## 15. Skroty i zachowanie UI

- `Esc` zamyka modal edycji builda
- `Esc` zamyka drawer `Szybkie buildy`
- `Esc` zamyka modal walidacji
- `Delete` usuwa aktualnie edytowany build

## 16. Favicon

Aplikacja korzysta z:
- `images/favicon.png`

## 17. Architektura techniczna

### Frontend

Stack:
- HTML
- CSS
- vanilla JavaScript

Frontend odpowiada za:
- zarzadzanie stanem aplikacji,
- render flow i node'ow,
- generacje JSON,
- obsluge `localStorage`,
- walidacje formularzy.

### Backend IIS

W projekcie dzialaja lekkie endpointy ASP.NET Web Forms:
- `save-deploys.aspx`
- `load-deploys.aspx`
- `activity-log.aspx`
- `validate-artifactory.aspx`
- `whoami.aspx`

## 18. Najwazniejsze pliki projektu

- `index.html` - UI
- `styles.css` - style
- `app.js` - logika klienta
- `save-deploys.aspx` - backend zapisu deployow
- `save-deploys.ps1` - zapis plikow na dysk
- `load-deploys.aspx` - odczyt plikow z katalogu deploya
- `activity-log.aspx` - logowanie aktywnosci
- `validate-artifactory.aspx` - walidacja Artifactory
- `whoami.aspx` - identyfikacja uzytkownika
- `web.config` - konfiguracja IIS
- `Resolve-ArtifactoryKeePass.ps1` - pobieranie hasla z KeePassVault
- `App_Data/artifactory.config.json` - konfiguracja Artifactory

## 19. Konfiguracja IIS

`web.config` ustawia m.in.:
- `customErrors mode="Off"`
- obsluge `401/403` do `access-denied.html`
- `index.html` jako default document
- MIME dla `.json`, `.woff`, `.woff2`
- wylaczony cache dla statyk
- naglowki:
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: SAMEORIGIN`
  - `X-XSS-Protection: 1; mode=block`

## 20. Logowanie aktywnosci

Aktywnosc jest zapisywana do:
- `D:\PROD_REPO_DATA\IIS\DeployJsonGenerator\userActivity.log`

Przykladowe zdarzenia:
- `PAGE_LOAD`
- `SERVER_SWITCH`
- `FLOW_ADD`
- `FLOW_REMOVE`
- `FLOW_SETTING_UPDATE`
- `NODE_ADD`
- `RUNNER_ADD`
- `NODE_SAVE`
- `NODE_DELETE`
- `BULK_ADD_BUILDS`
- `JSON_SAVE_CURRENT`
- `JSON_SAVE_FLOW`
- `JSON_SAVE_ALL`
- `JSON_LOAD_DEPLOY`
- `FERRYT_VALIDATE_START`
- `FERRYT_VALIDATE_OK`
- `FERRYT_VALIDATE_ERROR`

## 21. Konfiguracja Artifactory

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

Jesli `authMode` wskazuje KeePass albo haslo jest puste, endpoint probuje pobrac haslo przez `Resolve-ArtifactoryKeePass.ps1`.

## 22. Utrzymanie i testy reczne

Minimum po zmianach:
1. Dodanie zwyklego builda i zapis JSON.
2. Dodanie zaleznosci miedzy buildami.
3. Dodanie zaleznosci miedzy plikami JSON.
4. Test `Szybkich buildow` dla zwyklej nazwy i pelnego linku TeamCity.
5. Test runnerow specjalnych i ich `params`.
6. Test Ferryt i `Validate`.
7. Test zapisu do katalogu deploya.
8. Test wczytania JSON-ow z wybranej daty.
9. Test odswiezenia strony i odtworzenia `localStorage`.

## 23. Najczestsze problemy

### Nie widac nowych zmian na produkcji

Sprawdz:
- czy wdrozenie trafil do wlasciwego katalogu IIS,
- czy statyki nie sa serwowane ze starego cache,
- czy laduja sie pliki `styles.css` i `app.js` z aktualnym parametrem `?v=...`.

### Brak wpisow w `userActivity.log`

Sprawdz:
- czy AppPool ma prawo zapisu do `D:\PROD_REPO_DATA\IIS\DeployJsonGenerator\`,
- czy `activity-log.aspx` odpowiada poprawnie,
- czy IIS zwraca login domenowy, jesli oczekiwany jest konkretny user.

### Walidacja Artifactory zwraca HTML zamiast JSON

Sprawdz:
- `web.config`,
- `validate-artifactory.aspx`,
- dostepnosc `App_Data/artifactory.config.json`.

## 24. Changelog

Pelna historia zmian znajduje sie w `CHANGELOG.md`.

## 25. Autorstwo

Footer aplikacji wskazuje:
- `(c) 2026 DEI-ZUK-C | L.Peryt`
