// action.js — 게임 행동 처리 (수입, 해외원조, 쿠데타)

const { roleNames, nextTurn, checkEliminated, checkWinner, sendGameStateToAll } = require("./state");

// 행동 관련 이벤트를 소켓에 등록하는 함수
function registerActionEvents(socket, io, rooms) {

    // --- 행동 선택 ---
    socket.on("action", (data) => {
        const code = socket.roomCode;
        const room = rooms[code];
        if (!room || !room.game) return;

        const game = room.game;
        const nickname = socket.nickname;

        // 내 턴인지 확인
        if (game.turnOrder[game.currentTurnIndex] !== nickname) return;
        if (game.phase !== "action") return;

        const player = game.players[nickname];

        // 코인 10개 이상이면 반드시 쿠데타
        if (player.coins >= 10 && data.action !== "coup") {
            socket.emit("error_msg", "코인이 10개 이상이면 반드시 쿠데타를 해야 합니다!");
            return;
        }

        // --- 수입 ---
        if (data.action === "income") {
            player.coins += 1;
            io.to(code).emit("action_log", `${nickname}이(가) 수입을 선택했습니다. (코인 +1)`);
            nextTurn(room);
            sendGameStateToAll(code, rooms, io);
        }

        // --- 해외 원조 ---
        else if (data.action === "foreign_aid") {
            player.coins += 2;
            io.to(code).emit("action_log", `${nickname}이(가) 해외 원조를 받았습니다. (코인 +2)`);
            nextTurn(room);
            sendGameStateToAll(code, rooms, io);
        }

        // --- 쿠데타 ---
        else if (data.action === "coup") {
            if (player.coins < 7) {
                socket.emit("error_msg", "쿠데타에는 코인 7개가 필요합니다.");
                return;
            }
            if (!data.target) {
                socket.emit("error_msg", "쿠데타 대상을 선택하세요.");
                return;
            }
            if (game.players[data.target].cards.length === 0) {
                socket.emit("error_msg", "이미 탈락한 플레이어입니다.");
                return;
            }

            player.coins -= 7;
            io.to(code).emit("action_log", `${nickname}이(가) ${data.target}에게 쿠데타를 선언했습니다!`);

            // 카드 1장이면 바로 제거
            if (game.players[data.target].cards.length === 1) {
                const lostCard = game.players[data.target].cards.pop();
                
                // 죽은 카드 목록에 추가
                if (!game.players[data.target].deadCards) game.players[data.target].deadCards = [];
                game.players[data.target].deadCards.push(lostCard);

                io.to(code).emit("action_log", `${data.target}의 ${roleNames[lostCard]}이(가) 제거되었습니다.`);

                checkEliminated(room);
                if (!checkWinner(room, code, io)) {
                    nextTurn(room);
                }
                // 게임 끝나든 안 끝나든 항상 상태 전송 (죽은 카드 공개용)
                sendGameStateToAll(code, rooms, io);

            }
            // 카드 2장이면 선택하게 함
            else {
                game.phase = "lose_card";
                game.pendingAction = {
                    type: "coup",
                    actor: nickname,
                    loser: data.target
                };
                sendGameStateToAll(code, rooms, io);
            }
        }
    });

    // --- 카드 버리기 ---
    socket.on("lose_card", (data) => {
        const code = socket.roomCode;
        const room = rooms[code];
        if (!room || !room.game) return;

        const game = room.game;

        if (!game.pendingAction || game.pendingAction.loser !== socket.nickname) return;
        if (game.phase !== "lose_card") return;

        const loser = game.players[socket.nickname];
        if (data.cardIndex < 0 || data.cardIndex >= loser.cards.length) return;

        const lostCard = loser.cards.splice(data.cardIndex, 1)[0];

        // 죽은 카드 목록에 추가 (공개용)
        if (!loser.deadCards) loser.deadCards = [];
        loser.deadCards.push(lostCard);

        io.to(code).emit("action_log", `${socket.nickname}의 ${roleNames[lostCard]}이(가) 제거되었습니다.`);

        checkEliminated(room);
        if (!checkWinner(room, code, io)) {
            nextTurn(room);
        }
        sendGameStateToAll(code, rooms, io);

    });
}

module.exports = { registerActionEvents };