const express = require("express")
const http = require("http")
const { Server } = require("socket.io")
const sqlite3 = require("sqlite3").verbose()
const path = require("path")

const app = express()
const server = http.createServer(app)
const io = new Server(server)

app.use(express.json())
app.use(express.static("public"))

/* =========================
   BASE DE DATOS SQLITE
========================= */

const db = new sqlite3.Database("./database.db")

db.serialize(()=>{

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

app.post("/login",(req,res)=>{

const {user,pass}=req.body

db.get(
"SELECT * FROM users WHERE user=? AND pass=?",
[user,pass],
(err,row)=>{

if(row){

db.get(
"SELECT points FROM ranking WHERE user=?",
[user],
(err,rank)=>{

res.json({
ok:true,
points: rank ? rank.points : 0
})

})

}else{

res.json({ok:false})

}

})

})

/* =========================
   CREAR USUARIO
========================= */

app.post("/create",(req,res)=>{

const {user,pass}=req.body

db.run(
"INSERT INTO users(user,pass) VALUES(?,?)",
[user,pass],
(err)=>{

if(err){
res.json({ok:false})
}else{
res.json({ok:true})
}

})

})

/* =========================
   VER USUARIOS
========================= */

app.get("/users",(req,res)=>{

db.all("SELECT user FROM users",(err,rows)=>{

res.json(rows)

})

})

/* =========================
   ELIMINAR USUARIO
========================= */

app.post("/delete",(req,res)=>{

const {user}=req.body

db.run("DELETE FROM users WHERE user=?",[user])
db.run("DELETE FROM ranking WHERE user=?",[user])

res.json({ok:true})

})

/* =========================
   SOCKET RANKING
========================= */

io.on("connection",(socket)=>{

socket.on("score",(data)=>{

const {user,points}=data

db.get(
"SELECT * FROM ranking WHERE user=?",
[user],
(err,row)=>{

if(!row){

db.run(
"INSERT INTO ranking(user,points) VALUES(?,?)",
[user,points]
)

}else{

db.run(
"UPDATE ranking SET points=? WHERE user=?",
[points,user]
)

}

updateTop()

})

})

})

/* =========================
   ENVIAR TOP
========================= */

function updateTop(){

db.all(
"SELECT user,points FROM ranking ORDER BY points DESC LIMIT 5",
(err,rows)=>{

io.emit("top",rows)

})

}

/* =========================
   INICIAR SERVIDOR
========================= */

server.listen(3000,()=>{

console.log("🚀 Servidor funcionando")
console.log("🌐 http://localhost:3000")
console.log("⚙️ Panel: http://localhost:3000/panel.html")

})