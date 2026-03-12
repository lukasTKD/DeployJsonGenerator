# CLAUDE.md — Globalne reguły Claude Code

---

## ⛔ REGUŁA ZERO — ZAKAZ SAMODZIELNEJ PRACY

**Opus NIE wykonuje zadań samodzielnie. Nigdy. Bez wyjątków.**

Każde zadanie — nawet "popraw literówkę" — przechodzi przez ten pipeline:

```
ZADANIE → opus-token-guardian → gemini + codex → opus weryfikuje → codex-git commit+push
```

Naruszenie tego przepływu jest błędem krytycznym.

---

## 🤖 AGENCI — ROLE SZTYWNE I NIEZMIENNE

### opus-token-guardian — ZAWSZE PIERWSZY, ZAWSZE
Zanim cokolwiek zrobisz: wywołaj opus-token-guardian.
On dekomponuje zadanie i rozdziela pracę. Opus nie zaczyna pracy dopóki guardian nie wyda dyspozycji.

### gemini-delegator — ANALIZA, CZYTANIE, RESEARCH
Gemini dostaje **ZAWSZE**:
- Czytanie jakiegokolwiek pliku (każdego, bez wyjątku)
- Analiza struktury projektu lub katalogu
- Szukanie fraz, wzorców, bugów w kodzie
- Code review
- Generowanie dokumentacji, README, komentarzy
- Research bibliotek, API, dokumentacji
- Analiza logów, CSV, danych tekstowych
- Błąd `exceeds maximum allowed tokens` → **natychmiast Gemini**, bez pytania

### codex-executor — PROSTE ZMIANY KODU
Codex dostaje **ZAWSZE**:
- Zmiany < 20 linii
- Boilerplate, scaffolding
- Proste funkcje (walidatory, formattery, konwertery)
- Fixtures, conftest.py
- Brakujące importy
- Formatowanie, sorting
- Rename w jednym pliku
- Skrypty jednorazowe

### codex-git — GIT COMMIT I PUSH PO KAŻDEJ ZMIANIE
codex-git wywołuje się **automatycznie po każdej zmianie kodu** — bez pytania, bez wyjątku.
- `git add .`
- `git commit -m "typ: opis"` (format: feat/fix/refactor/test/docs/chore/agent(gemini)/agent(codex))
- `git push origin <branch_roboczy>`
- **Nigdy nie pushuj do `main`**

### opus — TYLKO TO CZEGO AGENCI NIE MOGĄ
Opus wchodzi **wyłącznie** gdy:
- Złożona architektura lub logika biznesowa
- Debugging trudnego problemu wymagającego rozumowania
- Integracja między modułami
- Weryfikacja i korekta wyników agentów
- Strategie tradingowe, modele ML, decyzje projektowe

---

## ⚙️ WYWOŁANIE AGENTÓW

**Przez Task tool (preferowane):**
```
Użyj agenta opus-token-guardian do zadania: [opis]
```

**Gemini bezpośrednio:**
```powershell
powershell -ExecutionPolicy Bypass -Command "New-Item -ItemType Directory -Force -Path '.claude\agent-results' | Out-Null; gemini -p 'ZADANIE' 2>&1 | Out-File '.claude\agent-results\gemini_result.txt' -Encoding UTF8; Get-Content '.claude\agent-results\gemini_result.txt'"
```

**Codex bezpośrednio:**
```powershell
powershell -ExecutionPolicy Bypass -Command "New-Item -ItemType Directory -Force -Path '.claude\agent-results' | Out-Null; codex exec --full-auto 'ZADANIE' 2>&1 | Out-File '.claude\agent-results\codex_result.txt' -Encoding UTF8; Get-Content '.claude\agent-results\codex_result.txt'"
```

**Gemini + Codex równolegle:**
```powershell
powershell -ExecutionPolicy Bypass -File "$env:USERPROFILE\.claude\scripts\parallel-agents.ps1" `
  -GeminiTask "ZADANIE" -CodexTask "ZADANIE" `
  -WorkDir (Get-Location).Path
```

---

## ✅ PRZEPŁYW KAŻDEGO ZADANIA

```
1. opus-token-guardian   → dekomponuje zadanie
2. gemini-delegator      → czyta pliki, analizuje, researches
3. codex-executor        → mechaniczne zmiany kodu
4. opus                  → weryfikuje wyniki, wykonuje złożoną logikę
5. codex-git             → git add + commit + push (ZAWSZE, BEZ PYTANIA)
```

Kroki 2 i 3 mogą być równoległe jeśli zadania są niezależne.

---

## 🌍 ZASADY OGÓLNE
- Język: **polski**
- Czasy: **Warsaw (CET/CEST)**
- Logowanie: `logging`, nie `print()`
- Nie modyfikuj `.env` bez prośby
- Nie pushuj sekretów/kluczy

---

## 🔍 WERYFIKACJA SYSTEMU
```powershell
powershell -ExecutionPolicy Bypass -File "$env:USERPROFILE\.claude\scripts\verify-agents.ps1" -Quick
```
