require("dotenv").config();
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");
const os = require("os");
const mysql = require("mysql2/promise");

const app = express();
const server = http.createServer(app);


// Middleware do parsowania JSON
app.use(express.json());

// Konfiguracja połączenia z MySQL
// Конфігурація під Railway
const dbConfig = {
  host: process.env.MYSQLHOST,
  user: process.env.MYSQLUSER,
  password: process.env.MYSQLPASSWORD,
  database: process.env.MYSQLDATABASE,
  port: Number(process.env.MYSQLPORT),

  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,

  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
};



console.log({
  host: process.env.MYSQLHOST,
  port: process.env.MYSQLPORT,
  user: process.env.MYSQLUSER,
  database: process.env.MYSQLDATABASE,
});



// Utwórz pulę połączeń
const pool = mysql.createPool(dbConfig);

// Flaga do śledzenia statusu bazy danych
let dbReady = false;

// Funkcja do inicjalizacji bazy danych (nie blokuje startowania serwera)
async function initDatabase() {
  try {
    const connection = await pool.getConnection();
    console.log("✅ Połączono z bazą danych MySQL");

    // Tworzymy tylko tabelę (baza już została utworzona w interfejsie Railway)
    await connection.query(`
      CREATE TABLE IF NOT EXISTS scores (
        id INT AUTO_INCREMENT PRIMARY KEY,
        team_name VARCHAR(255) NOT NULL,
        score INT NOT NULL,
        time_seconds INT NOT NULL,
        mode VARCHAR(50) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_score (score DESC)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    connection.release();
    dbReady = true;
    console.log("✓ Tablica wyników gotowa");
  } catch (error) {
    console.error("Połączenie z bazą danych nie powiodło się:", error.message);
    dbReady = false;
  }
}

// Inicjalizuj bazę danych w tle (nie czekaj)
initDatabase().catch(() => {
  console.log("Kontynuuję bez bazy danych...");
});

// Middleware CORS dla wszystkich żądań
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});

// Endpoint testowy PRZED Socket.io
app.get("/health", (req, res) => {
  console.log("GET /health - zwracam odpowiedź");
  res.json({ status: "ok", port: PORT, timestamp: new Date().toISOString() });
});

// API - Zapisz wynik
app.post("/api/scores", async (req, res) => {
  try {
    const { teamName, score, time, mode } = req.body;

    if (!teamName || score === undefined || time === undefined || !mode) {
      console.error("Brakuje wymaganych pól:", { teamName, score, time, mode });
      return res.status(400).json({ error: "Brakuje wymaganych pól" });
    }

    console.log(
      `POST /api/scores - zapisuję: ${teamName}, ${score} pkt, ${time}s, ${mode}`
    );

    // Jeśli baza danych nie jest dostępna, zwróć sukces (dane zostaną zapisane gdy DB będzie gotowa)
    if (!dbReady) {
      console.log("DB niedostępna - wynik nie został zapisany w bazie");
      return res.status(200).json({
        success: true,
        id: null,
        message: "Wynik przesłany (baza niedostępna, ranking niedostępny)",
      });
    }

    try {
      const [result] = await pool.query(
        "INSERT INTO scores (team_name, score, time_seconds, mode) VALUES (?, ?, ?, ?)",
        [teamName, score, time, mode]
      );

      console.log(`✅ Wynik zapisany w bazie - ID: ${result.insertId}`);
      return res.status(201).json({
        success: true,
        id: result.insertId,
        message: "Wynik zapisany",
      });
    } catch (dbError) {
      console.error("❌ Błąd bazy danych:", dbError.message);
      // Zwróć success=true aby nie przerywać gry
      return res.status(200).json({
        success: true,
        id: null,
        message: "Wynik przesłany (błąd bazy danych)",
      });
    }
  } catch (error) {
    console.error("❌ Błąd ogólny /api/scores:", error.message);
    return res.status(200).json({
      success: true,
      id: null,
      message: "Wynik przesłany (błąd serwera)",
    });
  }
});

// API - Pobierz ranking
app.get("/api/scores", async (req, res) => {
  try {
    if (!dbReady) {
      return res.status(200).json({
        success: true,
        scores: [],
        message: "Ranking niedostępny - baza danych nie jest połączona",
      });
    }

    const { sort = "score" } = req.query;

    let orderBy = "score DESC";
    if (sort === "time") {
      orderBy = "time_seconds ASC";
    } else if (sort === "date") {
      orderBy = "created_at DESC";
    }

    const [rows] = await pool.query(
      `SELECT id, team_name, score, time_seconds, mode, created_at 
       FROM scores 
       ORDER BY ${orderBy} 
       LIMIT 100`
    );

    // Formatuj wyniki
    const scores = rows.map((row) => ({
      id: row.id,
      teamName: row.team_name,
      score: row.score,
      time: row.time_seconds,
      mode: row.mode,
      date: row.created_at.toISOString(),
    }));

    return res.status(200).json({ success: true, scores });
  } catch (error) {
    console.error("Błąd pobierania wyników:", error);
    return res.status(200).json({
      success: true,
      scores: [],
      message: "Ranking niedostępny - błąd bazy danych",
    });
  }
});

// Middleware do logowania wszystkich żądań (tylko dla debugowania)
app.use((req, res, next) => {
  if (!req.url.startsWith("/socket.io/")) {
    console.log(`${req.method} ${req.url}`);
  }
  next();
});

// Przekieruj główną ścieżkę do index.html
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// Serwuj pliki statyczne
app.use(express.static(__dirname));

// Konfiguracja Socket.io - TYLKO dla ścieżki /socket.io/

const io = new Server(server, {
  // Użyj standardowej ścieżki bez końcowego slasha — prostsze dopasowanie klienta
  path: "/socket.io",
  cors: {
    origin: "*",
    methods: ["GET", "POST", "OPTIONS"],
    // przy origin: '*' nie ustawiamy credentials na true
    credentials: false,
  },
  transports: ["websocket", "polling"],
  // ping/connect timeouts dostosowane do niestabilnych sieci lokalnych
  pingTimeout: 60000,
  pingInterval: 25000,
  connectTimeout: 45000,
  // Łatwiej połączyć się z sieci lokalnej
  allowEIO3: true,
});

// Logowanie połączeń dla debugowania
io.engine.on("connection_error", (err) => {
  console.error("Błąd połączenia Socket.io:", err);
});

// Przechowuj pokoje multiplayer
const rooms = new Map();

io.on("connection", (socket) => {
  console.log("Użytkownik połączony:", socket.id);

  // Utwórz pokój
  socket.on("createRoom", ({ teamName }) => {
    const roomId = generateRoomId();
    rooms.set(roomId, {
      host: {
        id: socket.id,
        teamName,
        score: 0,
        time: 0,
        finished: false,
        finishTimestamp: null,
      },
      guest: null,
      started: false,
    });

    socket.join(roomId);
    socket.emit("roomCreated", { roomId });
    console.log(`Pokój utworzony: ${roomId} przez ${teamName}`);
  });

  // Dołącz do pokoju
  socket.on("joinRoom", ({ roomId, teamName }) => {
    const room = rooms.get(roomId);
    if (!room) {
      socket.emit("error", { message: "Pokój nie istnieje" });
      return;
    }

    if (room.guest) {
      socket.emit("error", { message: "Pokój jest pełny" });
      return;
    }

    room.guest = {
      id: socket.id,
      teamName,
      score: 0,
      time: 0,
      finished: false,
      finishTimestamp: null,
    };

    socket.join(roomId);
    socket.emit("roomJoined", { roomId });

    // Powiadom hosta o dołączeniu gościa
    io.to(room.host.id).emit("opponentJoined", {
      opponentName: teamName,
    });

    // Powiadom gościa o hostcie
    socket.emit("opponentJoined", {
      opponentName: room.host.teamName,
    });

    console.log(`${teamName} dołączył do pokoju ${roomId}`);
  });

  // Rozpocznij grę (tylko host może)
  socket.on("startGame", ({ roomId }) => {
    const room = rooms.get(roomId);
    if (!room || room.host.id !== socket.id) {
      return;
    }

    if (!room.guest) {
      socket.emit("error", { message: "Czekaj na przeciwnika" });
      return;
    }

    room.started = true;
    io.to(roomId).emit("gameStart");
    console.log(`Gra rozpoczęta w pokoju ${roomId}`);
  });

  // Aktualizacja wyniku
  socket.on("scoreUpdate", ({ roomId, score }) => {
    const room = rooms.get(roomId);
    if (!room) return;

    // Zaktualizuj wynik gracza
    if (room.host.id === socket.id) {
      room.host.score = score;
      // Wyślij do gościa
      if (room.guest) {
        io.to(room.guest.id).emit("opponentUpdate", {
          score: room.host.score,
        });
      }
    } else if (room.guest && room.guest.id === socket.id) {
      room.guest.score = score;
      // Wyślij do hosta
      io.to(room.host.id).emit("opponentUpdate", {
        score: room.guest.score,
      });
    }
  });

  // Gra zakończona
  socket.on("gameFinished", ({ roomId, teamName, score, time }) => {
    const room = rooms.get(roomId);
    if (!room) return;

    const finishTime = Date.now(); // Czas zakończenia w milisekundach

    // Zapisz wynik gracza
    if (room.host.id === socket.id) {
      room.host.score = score;
      room.host.time = time; // Czas w sekundach
      room.host.finished = true;
      room.host.finishTimestamp = finishTime;
      room.host.teamName = teamName;
    } else if (room.guest && room.guest.id === socket.id) {
      room.guest.score = score;
      room.guest.time = time; // Czas w sekundach
      room.guest.finished = true;
      room.guest.finishTimestamp = finishTime;
      room.guest.teamName = teamName;
    }

    // Sprawdź, czy obie drużyny ukończyły
    const bothFinished =
      room.host.finished && room.guest && room.guest.finished;

    if (bothFinished) {
      // Obie drużyny ukończyły - określ zwycięzcę
      let winner = null;
      let reason = "";

      if (room.host.score > room.guest.score) {
        winner = "host";
        reason = "Więcej punktów";
      } else if (room.guest.score > room.host.score) {
        winner = "guest";
        reason = "Więcej punktów";
      } else {
        // Remis punktów - wygrywa szybsza drużyna (mniejszy czas)
        if (room.host.time < room.guest.time) {
          winner = "host";
          reason = "Równe punkty, szybszy czas";
        } else if (room.guest.time < room.host.time) {
          winner = "guest";
          reason = "Równe punkty, szybszy czas";
        } else {
          winner = "draw";
          reason = "Pełny remis";
        }
      }

      // Wyślij wyniki do obu graczy
      const hostResult = {
        myScore: room.host.score,
        myTime: room.host.time,
        opponentScore: room.guest.score,
        opponentTime: room.guest.time,
        opponentName: room.guest.teamName,
        isWinner: winner === "host",
        isDraw: winner === "draw",
        reason: reason,
      };

      const guestResult = {
        myScore: room.guest.score,
        myTime: room.guest.time,
        opponentScore: room.host.score,
        opponentTime: room.host.time,
        opponentName: room.host.teamName,
        isWinner: winner === "guest",
        isDraw: winner === "draw",
        reason: reason,
      };

      io.to(room.host.id).emit("gameResult", hostResult);
      io.to(room.guest.id).emit("gameResult", guestResult);

      console.log(
        `Gra zakończona w pokoju ${roomId}. Zwycięzca: ${
          winner === "host"
            ? room.host.teamName
            : winner === "guest"
            ? room.guest.teamName
            : "remis"
        }`
      );
    } else {
      // Tylko jedna drużyna ukończyła - powiadom przeciwnika, że czeka
      const opponent = room.host.id === socket.id ? room.guest : room.host;
      if (opponent) {
        io.to(opponent.id).emit("opponentFinished", {
          teamName,
          score,
          time,
          waiting: true, // Oznacz, że czekamy na drugą drużynę
        });
      }
    }
  });

  // Rozłączenie
  socket.on("disconnect", () => {
    console.log("Użytkownik rozłączony:", socket.id);

    // Usuń pokój jeśli host się rozłączył
    for (const [roomId, room] of rooms.entries()) {
      if (room.host.id === socket.id) {
        if (room.guest) {
          io.to(room.guest.id).emit("hostDisconnected");
        }
        rooms.delete(roomId);
        console.log(`Pokój ${roomId} usunięty (host rozłączony)`);
        break;
      } else if (room.guest && room.guest.id === socket.id) {
        room.guest = null;
        io.to(room.host.id).emit("opponentLeft");
        console.log(`Gość opuścił pokój ${roomId}`);
        break;
      }
    }
  });
});

// Generuj losowe ID pokoju (6 znaków)
function generateRoomId() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let result = "";
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Znajdź lokalny IP adres do wypisania
// Znajdź lokalny IP adres
function getLocalIp() {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === "IPv4" && !net.internal) {
        return net.address;
      }
    }
  }
  return "localhost";
}

const isRender = !!process.env.RENDER;
const localIp = isRender ? "localhost" : getLocalIp();

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});


// Obsługa błędów serwera (np. EADDRINUSE)
server.on("error", (err) => {
  console.error("Błąd serwera:", err);
  if (err.code === "EADDRINUSE") {
    console.error(
      `Port ${PORT} jest już używany. Zakończ proces lub zmień PORT.`
    );
  }
});
