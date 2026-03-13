# Deploy JSON Generator - instrukcja uzytkownika

## 1. Do czego sluzy aplikacja
Aplikacja sluzy do przygotowania i edycji plikow JSON do deployow:
- dodawania buildow,
- ustawiania zaleznosci miedzy buildami,
- ustawiania zaleznosci miedzy plikami JSON,
- zapisywania plikow bezposrednio do katalogu deploya,
- wczytywania istniejacych plikow JSON z wybranej daty instalacji.

## 2. Podstawowy workflow
1. Wybierz serwer: `haaTeamCity.mbank.pl`, `TeamCity.mbank.pl` albo `Ferryt`.
2. Ustaw `Nazwe pliku JSON`, `Date instalacji` i pozostale parametry pliku.
3. Dodaj buildy:
   - recznie przyciskiem `+ Dodaj Build`,
   - przez panel `Szybkie buildy`,
   - albo przez przyciski runnerow dla `haaTeamCity`.
4. Ustaw zaleznosci miedzy buildami przez polaczenia na diagramie.
5. Ustaw zaleznosci miedzy plikami w sekcji `Zaleznosci miedzy plikami JSON`.
6. Zapisz jeden plik albo wszystkie pliki do katalogu deploya.

## 3. Data instalacji i katalog zapisu
- Pole `Data instalacji` steruje katalogiem docelowym zapisu.
- Pliki zapisywane sa do:
  `D:\PROD_REPO_DATA\AutomateDeploy\Deploys\YYYY-MM-DD`
- Przy zapisie aplikacja sprawdza, czy katalog dla tej daty istnieje.
- Jesli nie istnieje, katalog jest tworzony automatycznie.

## 4. Wczytywanie istniejacych JSON-ow
- Przy `Data instalacji` uzyj przycisku `Wczytaj z daty`.
- Aplikacja odczyta pliki JSON z katalogu dla wybranej daty i zaladuje je do edytora.
- Wczytanie zastapi biezaca zawartosc edytora.
- Podczas importu odtwarzane sa:
  - buildy,
  - `waitfor` miedzy buildami,
  - zaleznosci miedzy plikami JSON.

## 5. Szybkie buildy
- Otworz panel `Szybkie buildy`.
- Wklej liste buildow lub pelne linki TeamCity, po jednym wpisie na linie.
- Kliknij `Dodaj buildy`.

Wazne:
- duplikaty na wklejonej liscie sa blokowane,
- konflikt nazw z istniejacymi node'ami jest rozwiazywany automatycznie przez dopisanie sufiksu,
- dostepny jest checkbox `external = 1`, ktory ustawia `external` dla wszystkich nowo dodanych buildow.

## 6. Specjalne buildy runnerow
Dla `haaTeamCity` dostepne sa gotowe przyciski dodawania runnerow.

Aktualne `buildid`:
- `AutomateDeploy_SqlRunner`
- `AutomateDeploy_ScriptRunner`
- `AnsiblePlaybookRunner_ProdRunPlaybookAnsible`

Po ustawieniu odpowiedniego `buildid` pojawiaja sie dodatkowe pola `params`.

### 6.1 AutomateDeploy_SqlRunner
Wymagane pola:
- `sqlserver`
- `database`
- `file`

### 6.2 AutomateDeploy_ScriptRunner
Wymagane pola:
- `servers`
- `file`

### 6.3 AnsiblePlaybookRunner_ProdRunPlaybookAnsible
Dostepne pola:
- `inventory_path`
- `git.envbook.repo.branch`
- `playbook_path`

## 7. Buildy, ktore moga wystepowac wielokrotnie
Ponisze `buildid` moga pojawic sie wielokrotnie w jednym pliku JSON:
- `AutomateDeploy_SqlRunner`
- `AutomateDeploy_ScriptRunner`
- `AnsiblePlaybookRunner_ProdRunPlaybookAnsible`

Pozostale `buildid` sa walidowane pod katem duplikatow w ramach jednego pliku.

## 8. Zaleznosci
### 8.1 Miedzy buildami
- przeciagnij polaczenie z jednego node'a na drugi,
- docelowy node dostanie `waitfor` wskazujacy poprzedni build.

### 8.2 Miedzy plikami JSON
- uzyj sekcji `Zaleznosci miedzy plikami JSON`,
- zaznacz, ktore pliki maja wykonac sie wczesniej.

## 9. Zapisywanie
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

## 10. Dostep do aplikacji
- Dostep do strony jest kontrolowany przez `Authorization Rules` w IIS.
- Uzytkownik bez dostepu zobaczy osobna strone informacyjna.
- Uprawniony uzytkownik nie widzi tego komunikatu na glownej stronie aplikacji.

## 11. Favicon
Aplikacja korzysta z:
- `images/favicon.png`

## 12. Zapisywanie stanu pracy
Stan edytora zapisuje sie automatycznie w `localStorage`, dzieki czemu po odswiezeniu strony mozna przywrocic ostatnia lokalna sesje.
