# Dokumentacja: buildid `TC_SQL` i `TC_PowerShell`

## Cel
Ten dokument opisuje:
- jak działa obsługa specjalnych buildów `TC_SQL` i `TC_PowerShell`,
- gdzie dokładnie zmienić nazwy tych buildów w kodzie,
- jakie są skutki zmiany i jak je bezpiecznie wykonać.

---

## Aktualne działanie

Aplikacja ma dwa specjalne typy `buildid`:
- `TC_SQL`
- `TC_PowerShell`

Rozpoznawanie jest **case-insensitive** (bez znaczenia wielkości liter), czyli działają np.:
- `tc_sql`, `TC_SQL`, `Tc_Sql`
- `tc_powershell`, `TC_POWERSHELL`, `Tc_PowerShell`

Dla tych buildów:
1. Pokazują się dedykowane pola `params` w oknie edycji noda.
2. Duplikaty `buildid` są dozwolone (pod warunkiem unikalnej nazwy noda/klucza w `builds`).
3. Do JSON-a trafia sekcja `params` z odpowiednimi polami.

---

## Gdzie zmienić nazwę buildid (najważniejsze)

## 1) Logika rozpoznania buildid (KRYTYCZNE)
Plik: `app.js`

Funkcje:
- `isTcSql(buildId)`
- `isTcPowerShell(buildId)`

To one definiują, jaka wartość `buildid` jest traktowana jako specjalna.

Aktualnie:
- `isTcSql` porównuje do `'tc_sql'`
- `isTcPowerShell` porównuje do `'tc_powershell'`

### Przykład zmiany
Jeśli chcesz zmienić nazwy na:
- `SQL_JOB`
- `PS_JOB`

to zmień porównania odpowiednio na:
- `'sql_job'`
- `'ps_job'`

> Ważne: zostaw `toLowerCase()`, żeby nadal działało case-insensitive.

---

## 2) Mapa pól parametrów (informacyjnie)
Plik: `app.js`

Obiekt:
- `TC_BUILD_PARAMS`

Aktualnie:
- `TC_SQL` → `sqlserver`, `database`, `file`
- `TC_PowerShell` → `servers`, `file`

Ta mapa jest dokumentacyjna/pomocnicza. Główna logika i tak opiera się na funkcjach `isTcSql` i `isTcPowerShell`.

Jeśli chcesz spójności nazewnictwa, możesz zaktualizować też klucze w tej mapie do nowych nazw.

---

## 3) Miejsca zależne od rozpoznania buildid
Plik: `app.js`

Poniższe miejsca **automatycznie** będą działać po zmianie funkcji `isTcSql` i `isTcPowerShell`:
- pokazywanie/ukrywanie sekcji parametrów (`updateTcParamsVisibility`),
- zapis `params` (`saveTcParams`),
- walidacja duplikatów buildid (`validateBuildId`).

Nie trzeba ich przepisywać ręcznie, jeśli dalej używają funkcji helper.

---

## Schemat `params` w JSON

### Dla SQL
```json
"params": {
  "sqlserver": "",
  "database": "",
  "file": ""
}
```

### Dla PowerShell
```json
"params": {
  "servers": "",
  "file": ""
}
```

Sekcja `params` jest dodawana tylko dla specjalnych buildów.

---

## Procedura bezpiecznej zmiany nazw buildid

1. Zmień porównania w `isTcSql` i `isTcPowerShell`.
2. (Opcjonalnie) Zaktualizuj `TC_BUILD_PARAMS` dla spójności.
3. Uruchom aplikację i sprawdź:
   - czy po wpisaniu nowego `buildid` pojawiają się właściwe pola,
   - czy duplikaty nowego `buildid` są dozwolone,
   - czy JSON zawiera poprawne `params`.
4. Sprawdź starsze flow zapisane w localStorage (mogą mieć stare `buildid`).

---

## Kompatybilność wsteczna

Po zmianie nazw `buildid`, stare wpisy (`TC_SQL`, `TC_PowerShell`) mogą przestać uruchamiać specjalne zachowanie, jeśli nie przewidzisz aliasów.

Jeśli chcesz zachować kompatybilność, dodaj aliasy w helperach, np.:
- `isTcSql` akceptuje stare i nowe wartości,
- `isTcPowerShell` akceptuje stare i nowe wartości.

---

## Szybka checklista

- [ ] Zmienione `isTcSql`
- [ ] Zmienione `isTcPowerShell`
- [ ] (Opcjonalnie) zaktualizowane `TC_BUILD_PARAMS`
- [ ] Test UI (modal)
- [ ] Test JSON (`params`)
- [ ] Test duplikatów buildid

---

## Pliki powiązane
- `app.js` — logika rozpoznawania `buildid`, walidacja, zapis `params`
- `index.html` — pola formularza dla `TC_SQL` i `TC_PowerShell`
- `styles.css` — style sekcji parametrów
