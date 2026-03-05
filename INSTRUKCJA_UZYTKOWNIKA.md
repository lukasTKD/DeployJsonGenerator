# Deploy JSON Generator — instrukcja użytkownika

## 1. Do czego służy aplikacja
Aplikacja pomaga tworzyć pliki JSON do deployów:
- dodajesz buildy,
- ustawiasz zależności między buildami,
- ustawiasz zależności między plikami JSON,
- pobierasz gotowe pliki.

## 2. Podstawowy workflow
1. Wybierz serwer TeamCity.
2. Ustaw nazwę pliku JSON i parametry flow (np. `runat`, `enabled`).
3. Dodaj buildy:
   - ręcznie przyciskiem `+ Dodaj Build`, albo
   - przez panel `⚡ Szybkie buildy` (wklej listę buildów).
4. Połącz node’y na diagramie, aby ustawić `waitfor`.
5. Podejrzyj JSON po prawej stronie.
6. Pobierz jeden plik lub wszystkie pliki JSON.

## 3. Szybkie dodawanie buildów
- Kliknij pionowy przycisk `⚡ Szybkie buildy` po lewej stronie.
- Wklej listę buildów (jeden build na linię).
- Kliknij `Dodaj buildy`.

Ważne:
- duplikaty na wklejonej liście są blokowane,
- gdy nazwa builda koliduje z istniejącą nazwą node, aplikacja automatycznie doda sufiks (`_2`, `_3`...).

## 4. Specjalne buildy: TC_SQL i TC_PowerShell
W oknie edycji builda wpisz w `buildid`:
- `TC_SQL` (dowolna wielkość liter), albo
- `TC_PowerShell` (dowolna wielkość liter).

Po wpisaniu pojawią się dodatkowe pola `params`.

Dla `TC_SQL`:
- `sqlserver`
- `database`
- `file`

Dla `TC_PowerShell`:
- `servers`
- `file`

## 5. Zależności
### 5.1 Między buildami
- przeciągnij połączenie z jednego node’a na drugi,
- docelowy node dostanie `waitfor` wskazujący poprzedni build.

### 5.2 Między plikami JSON
- użyj sekcji `Zależności między plikami JSON`,
- zaznacz, które pliki mają być wykonane wcześniej.

## 6. Tryb External
W zakładce `External`:
- wklejasz listę buildów,
- generujesz JSON z `externa: 1` dla każdego builda,
- kopiujesz lub pobierasz wynik.

## 7. Najczęstsze wskazówki
- Jeśli nie widzisz dodatkowych pól TC: sprawdź, czy `buildid` jest ustawiony na `TC_SQL` lub `TC_PowerShell`.
- Jeśli panel szybkich buildów nie jest widoczny: użyj pionowego triggera po lewej.
- Jeśli chcesz wyczyścić flow: użyj przycisku `Wyczyść` na toolbarze diagramu.

## 8. Favicon
Aplikacja ma odnośnik do favicon:
- `images/favicon.png`

Wystarczy podmienić ten plik we własnym katalogu `images`.

## 9. Zapisywanie pracy
Stan aplikacji zapisuje się automatycznie w przeglądarce (localStorage), więc po odświeżeniu strony dane powinny wrócić.
