# Changelog

Wszystkie istotne zmiany w projekcie sa zapisywane tutaj.

## [2026-03-11]

### Added

- wsparcie dla pelnych linkow TeamCity w `Szybkich buildach` i `External`
- wsparcie dla linkow zakonczonych `#all-projects`
- wsparcie dla wariantu sciezki `buildConfiguradion` przy ekstrakcji `buildid`
- README jako glowna dokumentacja dla uzytkownika i developera
- ten plik `CHANGELOG.md`

### Changed

- parser wejscia list buildow normalizuje dane do samego `BUILD_ID`
- placeholdery i opisy UI informuja o mozliwosci wklejania pelnych linkow TeamCity
- odpowiedzi bledow walidacji Artifactory sa lepiej propagowane do klienta
- integracja Artifactory korzysta z `artifactoryUser` jako tytulu wpisu KeePass, gdy jest dostepny

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
