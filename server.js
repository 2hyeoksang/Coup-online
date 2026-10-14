// server.js — 서버 시작 + 이벤트 연결만 담당

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

// 우리가 만든 모듈 불러오기
// "./" = 현재 폴더 기준 경로
const { registerRoomEvents } = require("./game/room");
const { registerActionEvents } = require("./game/action");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// 이미지, HTML 제공
app.use("/images", express.static("images"));
// 현재 폴더의 css, js 파일도 브라우저에서 접근 가능하게
app.use(express.static(__dirname));
app.get("/", (req, res) => {
    res.sendFile(__dirname + "/index.html");
});

// 모든 방 정보를 저장하는 객체
// 이걸 room.js, action.js에 넘겨서 공유함
const rooms = {};

// 유저 접속 시
io.on("connection", (socket) => {
    console.log(`유저 접속: ${socket.id}`);

    // 각 모듈의 이벤트 등록 함수를 호출
    // socket, io, rooms를 넘겨서 각 모듈이 자기 담당 이벤트를 등록
    registerRoomEvents(socket, io, rooms);
    registerActionEvents(socket, io, rooms);
});

server.listen(3000, () => {
    console.log("서버 실행 중: http://localhost:3000");
});