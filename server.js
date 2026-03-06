const express = require("express")
const http = require("http")
const { Server } = require("socket.io")
const sqlite3 = require("sqlite3").verbose()
const path = require("path")

const app = express()
const server = http.createServer(app)
const io = new Server(server)

/* =========================
   CONFIGURACION EXPRESS
========================= */

app.use(express.json())
app.use(express.static(path.join(__dirname, "public")))

/* =========================
   BASE DE DATOS SQLITE
========================= */

const db = new sqlite3.Database("./database.db", (err) => {
  if (err) {
    console.log("❌ Error conectando SQLite:", err)
  } else {
    console.log("✅ SQLite conectado")
  }
})

db.serialize(() => {

  db.run(`
  CREATE TABLE IF NOT EXISTS users(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user TEXT UNIQUE,
    pass TEXT
  )
  `)

  db.run(`
  CREATE TABLE IF NOT EXISTS ranking(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user TEXT UNIQUE,
    points INTEGER
  )
  `)

})

/* =========================
   LOGIN
========================= */

app.post("/login", (req, res) => {

  const { user, pass } = req.body

  db.get(
    "SELECT * FROM users WHERE user=? AND pass=?",
    [user, pass],
    (err, row) => {

      if (row) {

        db.get(
          "SELECT points FROM ranking WHERE user=?",
          [user],
          (err, rank) => {

            res.json({
              ok: true,
              points: rank ? rank.points : 0
            })

          })

      } else {
        res.json({ ok: false })
      }

    })

})

/* =========================
   CREAR USUARIO
========================= */

app.post("/create", (req, res) => {

  const { user, pass } = req.body

  db.run(
    "INSERT INTO users(user,pass) VALUES(?,?)",
    [user, pass],
    function (err) {

      if (err) {
        res.json({ ok: false })
      } else {
        res.json({ ok: true })
      }

    })

})

/* =========================
   VER USUARIOS
========================= */

app.get("/ranking",(req,res)=>{

db.all(
"SELECT user,points FROM ranking ORDER BY points DESC LIMIT 10",
(err,rows)=>{
res.json(rows)
})

})

/* =========================
   ELIMINAR USUARIO
========================= */

app.post("/delete", (req, res) => {

  const { user } = req.body

  db.run("DELETE FROM users WHERE user=?", [user])
  db.run("DELETE FROM ranking WHERE user=?", [user])

  res.json({ ok: true })

})

/* =========================
   SOCKET.IO RANKING
========================= */

io.on("connection", (socket) => {

  console.log("👤 Usuario conectado")

  socket.on("score", (data) => {

    const { user, points } = data

    db.get(
      "SELECT * FROM ranking WHERE user=?",
      [user],
      (err, row) => {

        if (!row) {

          db.run(
            "INSERT INTO ranking(user,points) VALUES(?,?)",
            [user, points]
          )

        } else {

          db.run(
            "UPDATE ranking SET points=? WHERE user=?",
            [points, user]
          )

        }

        updateTop()

      })

  })

  socket.on("disconnect", () => {
    console.log("👤 Usuario desconectado")
  })

})

/* =========================
   TOP RANKING
========================= */

function updateTop() {

  db.all(
    "SELECT user,points FROM ranking ORDER BY points DESC LIMIT 5",
    (err, rows) => {

      if (!err) {
        io.emit("top", rows)
      }

    })

}

/* =========================
   PUERTO (IMPORTANTE RENDER)
========================= */

const PORT = process.env.PORT || 3000

server.listen(PORT, () => {

  console.log("🚀 Servidor corriendo")
  console.log("🌐 Puerto:", PORT)
  console.log("📊 Panel: /panel.html")

})