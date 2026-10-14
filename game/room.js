// room.js — 방 생성, 참가, 퇴장 처리

const { makeDeck, shuffle } = require("./deck");
const { sendGameStateToAll } = require("./state");

// 4자리 랜덤 방 코드 생성
function makeRoomCode() {
    return Math.random().toString(36).substr(2, 4).toUpperCase();
}

// 방 관련 이벤트를 소켓에 등록하는 함수
// socket = 접속한 유저, io = 서버 전체, rooms = 방 정보 저장소
function registerRoomEvents(socket, io, rooms) {

    // --- 방 만들기 ---
    socket.on("create_room", (nickname) => {
        let code = makeRoomCode();
        while (rooms[code]) {
            code = makeRoomCode();
        }

        rooms[code] = {
            players: [nickname],
            host: nickname,
            game: null
        };

        socket.join(code);
        socket.nickname = nickname;
        socket.roomCode = code;
        socket.emit("room_created", code);
        console.log(`방 생성: ${code} (방장: ${nickname})`);
    });

    // --- 방 참가 ---
    socket.on("join_room", (data) => {
        const { nickname, code } = data;

        if (!rooms[code]) {
            socket.emit("error_msg", "존재하지 않는 방 코드입니다.");
            return;
        }
        if (rooms[code].game) {
            socket.emit("error_msg", "이미 게임이 진행 중입니다.");
            return;
        }
        if (rooms[code].players.length >= 6) {
            socket.emit("error_msg", "방이 가득 찼습니다.");
            return;
        }

        rooms[code].players.push(nickname);
        socket.join(code);
        socket.nickname = nickname;
        socket.roomCode = code;

        io.to(code).emit("player_list", {
            players: rooms[code].players,
            host: rooms[code].host
        });

        console.log(`${nickname}이(가) ${code} 방에 참가`);
    });

    // --- 게임 시작 ---
    socket.on("start_game", () => {
        const code = socket.roomCode;
        const room = rooms[code];

        if (socket.nickname !== room.host) return;
        if (room.players.length < 2) {
            socket.emit("error_msg", "2명 이상이어야 게임을 시작할 수 있습니다.");
            return;
        }

        const deck = shuffle(makeDeck());

        room.game = {
            deck: deck,
            players: {},
            turnOrder: [...room.players],
            currentTurnIndex: 0,
            phase: "action",
            pendingAction: null
        };

        for (const name of room.players) {
            room.game.players[name] = {
                cards: [deck.pop(), deck.pop()],
                coins: 2
            };
        }

        console.log(`게임 시작: ${code}`);
        sendGameStateToAll(code, rooms, io);
    });

    // --- 유저 퇴장 ---
    socket.on("disconnect", () => {
        const code = socket.roomCode;
        const nickname = socket.nickname;

        if (code && rooms[code]) {
            rooms[code].players = rooms[code].players.filter(p => p !== nickname);

            if (rooms[code].game) {
                const game = rooms[code].game;

                if (game.players[nickname]) {
                    game.players[nickname].cards = [];
                }

                const turnIdx = game.turnOrder.indexOf(nickname);
                game.turnOrder = game.turnOrder.filter(p => p !== nickname);

                if (turnIdx < game.currentTurnIndex) {
                    game.currentTurnIndex--;
                }
                if (game.currentTurnIndex >= game.turnOrder.length) {
                    game.currentTurnIndex = 0;
                }

                if (game.turnOrder.length === 1) {
                    io.to(code).emit("game_over", game.turnOrder[0]);
                } else if (game.turnOrder.length > 1) {
                    sendGameStateToAll(code, rooms, io);
                }
            }

            if (rooms[code].players.length === 0) {
                delete rooms[code];
                console.log(`방 삭제: ${code}`);
            }
        }

        console.log(`유저 퇴장: ${nickname}`);
    });
}

module.exports = { registerRoomEvents };