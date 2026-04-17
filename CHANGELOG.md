# Changelog

Wszystkie istotne zmiany w projekcie sa zapisywane tutaj.

## [2026-04-17]

### Fixed

- build-level `waitfor` nie jest juz ograniczony do jednej zaleznosci; generator poprawnie importuje, utrzymuje i eksportuje wiele zaleznosci dla jednego builda
- zmiana `filename` przy zapisie nadpisuje stan na serwerze zamiast zostawiac stary plik obok nowego

## [2026-03-15]

### Changed

- import JSON-ow z katalogu jest bardziej tolerancyjny i akceptuje popularne warianty formatowania oraz struktury plikow spoza generatora
- generator zapisuje formatowany JSON z windowsowymi koncami linii `CRLF`

### Fixed

- wczytywanie plikow z komentarzami, BOM, koncowymi przecinkami oraz roznicami `CRLF/LF`
- import wariantow z `builds` albo `bilds`, `waitfor` jako string lub tablica oraz `params` jako obiekt lub lista
- komunikaty przy imporcie z daty: pomijane pliki sa teraz raportowane uzytkownikowi zamiast byc cicho ignorowane

## [2026-03-13]

### Added

- backendowy zapis deployow do katalogu daty z automatycznym tworzeniem folderu
- `load-deploys.aspx`
- przycisk `Wczytaj z daty`
- ekran `access-denied.html`
- jawna liste `buildid`, ktore moga sie powtarzac
- favicon z `images/favicon.png`

### Changed

- usunieto zakladke `External`
- `Szybkie buildy` dostaly checkbox `external = 1`
- przebudowano UI pod dodawanie i edycje plikow JSON
- zmieniono nazwy runnerow na:
  - `AutomateDeploy_SqlRunner`
  - `AutomateDeploy_ScriptRunner`
  - `AnsiblePlaybookRunner_ProdRunPlaybookAnsible`
- dodano cache-busting dla frontu i wylaczono cache statyk po IIS

### Fixed

- model zapisu `ASPX -> powershell.exe -> save-deploys.ps1`
- zgodnosc `save-deploys.ps1` z Windows PowerShell 5.1
- logowanie pelnej listy zapisanych plikow
- obsluge `401/403` w IIS
- blokade duplikatow dla `AnsiblePlaybookRunner_ProdRunPlaybookAnsible`

## [2026-03-11]

### Added

- wsparcie dla pelnych linkow TeamCity w masowym dodawaniu buildow
- logowanie aktywnosci do pliku
- `activity-log.aspx`

### Fixed

- walidacje `params` dla runnerow
- parser linkow TeamCity
- kompilacje walidatora ASP.NET

## [2026-03-10]

### Added

- walidacje paczek Ferryt w Artifactory
- integracje z KeePass dla hasla do Artifactory
