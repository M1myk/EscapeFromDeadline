## Escape Room: Release Day

Prosta gra webowa ucząca podstaw Scrum / Agile przez mechanikę „escape roomu” w biurze w dniu release’u.

### Jak uruchomić

#### Tryb Solo / Versus (bez serwera)

- **PL**:  
  - Otwórz plik `index.html` w przeglądarce (dwuklik lub „Open with…” w Chrome/Edge/Firefox).  
  - Nie jest potrzebny żaden backend ani instalacja zależności.

- **UA**:  
  - Відкрий файл `index.html` у браузері (подвійний клік або «Open with…» у Chrome/Edge/Firefox).  
  - Ніякий backend або інсталяція залежностей не потрібні.

#### Tryb Multiplayer (wymaga serwera i MySQL)

- **PL**:
  1. Zainstaluj Node.js (https://nodejs.org/) i MySQL (https://www.mysql.com/)
  2. Utwórz bazę danych MySQL:
     ```bash
     mysql -u root -p < database.sql
     ```
     Lub ręcznie:
     ```sql
     CREATE DATABASE escape_room_game;
     USE escape_room_game;
     -- Skopiuj zawartość z database.sql
     ```
  3. Skonfiguruj połączenie z bazą danych:
     - Utwórz plik `.env` w katalogu projektu:
     ```env
     PORT=3001
     DB_HOST=localhost
     DB_USER=root
     DB_PASSWORD=twoje_haslo
     DB_NAME=escape_room_game
     ```
  4. W terminalu w katalogu projektu wykonaj:
     ```bash
     npm install
     npm start
     ```
  5. Otwórz w przeglądarce: `http://localhost:3001`
  6. Aby grać z drugą drużyną:
     - Drużyna 1: wybierz "Multiplayer", wpisz nazwę, kliknij "Utwórz pokój" i skopiuj ID pokoju
     - Drużyna 2: wybierz "Multiplayer", wpisz nazwę, wklej ID pokoju i kliknij "Dołącz"
     - Gdy obie drużyny są gotowe, host klika "Rozpocznij grę"
     - Wygrywa drużyna z większą liczbą punktów (lub szybsza przy remisie punktów)!

- **UA**:
  1. Встанови Node.js (https://nodejs.org/) та MySQL (https://www.mysql.com/)
  2. Створи базу даних MySQL:
     ```bash
     mysql -u root -p < database.sql
     ```
     Або вручну:
     ```sql
     CREATE DATABASE escape_room_game;
     USE escape_room_game;
     -- Скопіюй вміст з database.sql
     ```
  3. Налаштуй підключення до бази даних:
     - Створи файл `.env` в каталозі проєкту:
     ```env
     PORT=3001
     DB_HOST=localhost
     DB_USER=root
     DB_PASSWORD=твій_пароль
     DB_NAME=escape_room_game
     ```
  4. У терміналі в каталозі проєкту виконай:
     ```bash
     npm install
     npm start
     ```
  5. Відкрий у браузері: `http://localhost:3001`
  6. Щоб грати з іншою командою:
     - Команда 1: обери "Multiplayer", введи назву, натисни "Utwórz pokój" і скопіюй ID кімнати
     - Команда 2: обери "Multiplayer", введи назву, встав ID кімнати і натисни "Dołącz"
     - Коли обидві команди готові, хост натискає "Rozpocznij grę"
     - Виграє команда з більшою кількістю балів (або швидша при рівності балів)!

### Zarys rozgrywki

- **PL**:
  - Wpisz nazwę zespołu i wybierz tryb:
    - **Solo**: graj samodzielnie
    - **Versus**: rywalizacja na czas/punkty (możesz porównać wyniki z innymi graczami)
    - **Multiplayer**: graj jednocześnie z inną drużyną online (wymaga serwera)
  - **Pokój 1 – Sprint Backlog**: przeciągaj elementy z Product Backlogu do Sprint Backlogu, pilnując story points i tego, żeby najważniejsze (must have) elementy były w sprincie.
  - **Pokój 2 – User Stories**: dopasuj User Stories do celu Sprintu, dzieląc je na „w tym Sprincie” i „później”.
  - **Pokój 3 – Konflikt PO–Dev**: wybierz rozwiązanie konfliktu release’owego, które jest spójne ze Scrumem.
  - Na końcu zobaczysz podsumowanie punktów, czasu oraz krótkie podsumowanie wiedzy (role, artefakty, ceremonie).
  - **Ranking**: kliknij "Ranking" na ekranie startowym, aby zobaczyć najlepsze wyniki wszystkich graczy.

- **UA**:
  - Введи назву команди та обери режим:
    - **Solo**: грай самостійно
    - **Versus**: змагання на час/бали (можеш порівняти результати з іншими гравцями)
    - **Multiplayer**: грай одночасно з іншою командою онлайн (потрібен сервер)
  - **Кімната 1 – Sprint Backlog**: перетягай елементи з Product Backlog до Sprint Backlog, слідкуючи за story points та тим, щоб must have елементи потрапили у спринт.
  - **Кімната 2 – User Stories**: співстав User Stories з ціллю спринту, розділивши їх на «в цьому спринті» і «пізніше».
  - **Кімната 3 – Конфлікт PO–Dev**: вибери рішення конфлікту навколо релізу, яке відповідає Scrum.
  - Наприкінці побачиш підсумок балів, часу і короткий конспект знань (ролі, артефакти, церемонії).
  - **Рейтинг**: натисни "Ranking" на стартовому екрані, щоб побачити найкращі результати всіх гравців.

### Funkcje

- ✅ **3 pokoje escape room** z zagadkami Scrum
- ✅ **System punktów i czasu** dla rywalizacji
- ✅ **Ranking wyników** (MySQL) z sortowaniem i trwałym przechowywaniem
- ✅ **Multiplayer online** - dwie drużyny grają jednocześnie przez sieć
- ✅ **Synchronizacja wyników w czasie rzeczywistym** w trybie multiplayer
- ✅ **Określanie zwycięzcy** - po zakończeniu przez obie drużyny (punkty, potem czas)
- ✅ **Edukacyjne treści** o rolach, artefaktach i ceremoniach Scrum


# EscapeFromDeadline
