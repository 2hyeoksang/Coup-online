// state.js — 게임 상태 관리, 턴 넘기기, 승리 판정

// 역할 이름 한글 변환
const roleNames = {
    duke: "공작",
    assassin: "암살자",
    captain: "사령관",
    contessa: "귀부인",
    ambassador: "외교관"
};

// 다음 턴으로 넘기기
function nextTurn(room) {
    room.game.currentTurnIndex = 
        (room.game.currentTurnIndex + 1) % room.game.turnOrder.length;
    room.game.phase = "action";
    room.game.pendingAction = null;
}

// 탈락자 제거 — 카드 0장인 플레이어를 턴 순서에서 빼기
function checkEliminated(room) {
    const game = room.game;

    // 현재 턴인 플레이어 이름을 기억해둔다
    const currentPlayer = game.turnOrder[game.currentTurnIndex];

    // 카드 0장인 플레이어를 턴 순서에서 제거
    game.turnOrder = game.turnOrder.filter(
        name => game.players[name].cards.length > 0
    );

    // 현재 턴 플레이어가 새 배열에서 몇 번째인지 다시 찾는다
    const newIdx = game.turnOrder.indexOf(currentPlayer);

    if (newIdx !== -1) {
        // 현재 턴 플레이어가 살아있으면 그 위치로 맞춤
        game.currentTurnIndex = newIdx;
    } else {
        // 현재 턴 플레이어가 탈락했으면 (이 경우는 드묾)
        if (game.currentTurnIndex >= game.turnOrder.length) {
            game.currentTurnIndex = 0;
        }
    }
}

// 승리 확인 — 1명 남으면 게임 끝
// io와 code를 받아서 직접 이벤트를 보냄
function checkWinner(room, code, io) {
    if (room.game.turnOrder.length === 1) {
        io.to(code).emit("game_over", room.game.turnOrder[0]);
        return true;
    }
    return false;
}

// 특정 플레이어에게 보낼 게임 상태 만들기
// 핵심: 자기 카드는 내용을 보여주고, 상대 카드는 장수만
function getGameStateForPlayer(room, nickname) {
    const game = room.game;
    const currentTurn = game.turnOrder[game.currentTurnIndex];

    const state = {
        myCards: game.players[nickname].cards,
        myCoins: game.players[nickname].coins,
        // 내 죽은 카드 목록
        myDeadCards: game.players[nickname].deadCards || [],
        players: {},
        currentTurn: currentTurn,
        phase: game.phase,
        isMyTurn: currentTurn === nickname
    };

    if (game.pendingAction && game.pendingAction.loser === nickname) {
        state.mustLoseCard = true;
    }

    for (const name of Object.keys(game.players)) {
        state.players[name] = {
            coins: game.players[name].coins,
            cardCount: game.players[name].cards.length,
            isAlive: game.players[name].cards.length > 0,
            // 모든 플레이어의 죽은 카드를 공개
            deadCards: game.players[name].deadCards || []
        };
    }

    return state;
}

// 방의 모든 플레이어에게 각자의 게임 상태를 보내기
function sendGameStateToAll(code, rooms, io) {
    const room = rooms[code];
    const sockets = io.sockets.sockets;
    sockets.forEach((s) => {
        if (s.roomCode === code && s.nickname) {
            const state = getGameStateForPlayer(room, s.nickname);
            s.emit("game_state", state);
        }
    });
}

module.exports = { 
    roleNames, 
    nextTurn, 
    checkEliminated, 
    checkWinner, 
    getGameStateForPlayer, 
    sendGameStateToAll 
};