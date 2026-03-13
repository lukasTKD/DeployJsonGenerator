# Changelog

Wszystkie istotne zmiany w projekcie sa zapisywane tutaj.

## [2026-03-13]

### Added

- backendowy zapis deployow do `D:\PROD_REPO_DATA\AutomateDeploy\Deploys\YYYY-MM-DD` z automatycznym tworzeniem katalogu
- endpoint `load-deploys.aspx` do odczytu istniejacych plikow JSON z wybranej daty instalacji
- przycisk `Wczytaj z daty` w UI do importu zapisanych JSON-ow do edytora
- osobna strona `access-denied.html` dla uzytkownikow odrzuconych przez `Authorization Rules` w IIS
- jawna lista `buildid`, ktore moga wystepowac wielokrotnie w jednym pliku JSON
- favicon z `images/favicon.png`

### Changed

- usunieto zakladke `External` i jej funkcjonalnosc
- panel `Szybkie buildy` dostal checkbox ustawiajacy `external = 1` dla wszystkich dodawanych buildow
- obecny ekran zostal przebudowany pod dodawanie i edycje plikow JSON
- sekcja `Wszystkie pliki JSON` zostala przebudowana, aby stabilnie rozdzielac naglowek, przycisk zapisu i sciezke katalogu
- glowne nazwy runnerow zostaly zmienione:
  - `TC_SQL` -> `AutomateDeploy_SqlRunner`
  - `TC_PowerShell` -> `AutomateDeploy_ScriptRunner`
  - `TC_RunOnly` -> `AnsiblePlaybookRunner_ProdRunPlaybookAnsible`
- instrukcja uzytkownika zostala zaktualizowana do obecnego UI i aktualnych nazw `buildid`
- frontend dostal cache-busting dla `styles.css` i `app.js`, a IIS ma wylaczony cache dla statyk

### Fixed

- zapis przez backend dziala w modelu `ASPX -> powershell.exe -> save-deploys.ps1`, zgodnie z podejsciem z `prodHealtchCheck`
- `save-deploys.ps1` zostal dopasowany do Windows PowerShell 5.1
- logowanie aktywnosci zapisuje takze katalog docelowy i liste zapisanych plikow
- uprawniony uzytkownik nie widzi juz komunikatu o ograniczeniu dostepu na glownej stronie
- obsluga `401/403` w IIS zostala poprawiona przez przejscie z `ExecuteURL` na `responseMode=\"File\"`
- `AnsiblePlaybookRunner_ProdRunPlaybookAnsible` nie jest juz blokowany jako duplikat `buildid`

## [2026-03-11]

### Added

- wsparcie dla pelnych linkow TeamCity w `Szybkich buildach` i `External`
- wsparcie dla linkow zakonczonych `#all-projects`
- wsparcie dla wariantu sciezki `buildConfiguradion` przy ekstrakcji `buildid`
- README jako glowna dokumentacja dla uzytkownika i developera
- ten plik `CHANGELOG.md`
- logowanie aktywnosci uzytkownikow do `D:\PROD_REPO_DATA\IIS\DeployJsonGenerator\userActivity.log`
- endpoint `activity-log.aspx` do zapisu zdarzen uzytkownika

### Changed

- parser wejscia list buildow normalizuje dane do samego `BUILD_ID`
- placeholdery i opisy UI informuja o mozliwosci wklejania pelnych linkow TeamCity
- odpowiedzi bledow walidacji Artifactory sa lepiej propagowane do klienta
- integracja Artifactory korzysta z `artifactoryUser` jako tytulu wpisu KeePass, gdy jest dostepny
- frontend zapisuje najwazniejsze akcje uzytkownika do logu serwerowego

### Fixed

- nowe buildy parametryczne nie zostaja na diagramie po zamknieciu modala przez `X` bez zapisu
- `TC_SQL` i `TC_PowerShell` wymagaja uzupelnienia pol przed zapisem
- do JSON nie trafiaja puste `params`
- parser linkow TeamCity nie zapisuje juz pelnego URL jako `name` i `buildid`
- naprawiono kompilacje walidatora ASP.NET

## [2026-03-10]

### Added

- walidacja paczek Ferryt w Artifactory z poziomu UI
- resolver KeePass dla hasla do Artifactory
- dokumentacja techniczna i instrukcja uzytkownika w starszej formie plikow pomocniczych

### Changed

- konfiguracja Artifactory zostala dopasowana do pracy z KeePassVault

### Fixed

- obsluga walidatora Artifactory w IIS

## Format wersjonowania

Projekt nie korzysta obecnie z tagowanych wersji semver. Zmiany sa grupowane dziennie i mapowane na commity Git.
