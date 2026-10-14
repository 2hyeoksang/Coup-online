const socket = io();

let myNickname = "";
let isHost = false;
let currentState = null;
let selectingTarget = false;
let gameOver = false;  // 게임 종료 여부

// ===== HTML 요소들 =====
const nicknameInput = document.getElementById("nicknameInput");
const createBtn = document.getElementById("createBtn");
const codeInput = document.getElementById("codeInput");
const joinBtn = document.getElementById("joinBtn");
const lobby = document.getElementById("lobby");
const waiting = document.getElementById("waiting");
const roomCode = document.getElementById("roomCode");
const playerList = document.getElementById("playerList");
const startBtn = document.getElementById("startBtn");
const game = document.getElementById("game");
const opponents = document.getElementById("opponents");
const myCards = document.getElementById("myCards");
const myCoins = document.getElementById("myCoins");
const turnInfo = document.getElementById("turnInfo");
const actionArea = document.getElementById("action-area");
const actionPrompt = document.getElementById("action-prompt");
const coupBtn = document.getElementById("coupBtn");
const logArea = document.getElementById("log-area");
const myAreaTitle = document.getElementById("my-area-title");

const roleNames = {
    duke: "공작",
    assassin: "암살자",
    captain: "사령관",
    contessa: "귀부인",
    ambassador: "외교관"
};

// ===== 로비 이벤트 =====

createBtn.onclick = () => {
    const nickname = nicknameInput.value.trim();
    if (!nickname) { alert("닉네임을 입력하세요!"); return; }
    myNickname = nickname;
    isHost = true;
    socket.emit("create_room", nickname);
};

joinBtn.onclick = () => {
    const nickname = nicknameInput.value.trim();
    const code = codeInput.value.trim().toUpperCase();
    if (!nickname) { alert("닉네임을 입력하세요!"); return; }
    if (!code) { alert("방 코드를 입력하세요!"); return; }
    myNickname = nickname;
    socket.emit("join_room", { nickname, code });
};

codeInput.onkeydown = (e) => {
    if (e.key === "Enter") joinBtn.click();
};

// ===== 서버 응답 =====

socket.on("room_created", (code) => {
    roomCode.textContent = code;
    lobby.style.display = "none";
    waiting.style.display = "block";
    startBtn.style.display = "inline-block";
});

socket.on("player_list", (data) => {
    lobby.style.display = "none";
    waiting.style.display = "block";
    playerList.innerHTML = "";
    data.players.forEach((name) => {
        const div = document.createElement("div");
        div.className = "player";
        div.textContent = name + (name === data.host ? " ⭐" : "");
        playerList.appendChild(div);
    });
    if (!roomCode.textContent) {
        roomCode.textContent = codeInput.value.trim().toUpperCase();
    }
});

startBtn.onclick = () => {
    socket.emit("start_game");
};

// ===== 게임 상태 수신 =====

socket.on("game_state", (state) => {
    // 게임이 끝났으면 더 이상 업데이트 안 함
    if (gameOver) return;

    currentState = state;
    waiting.style.display = "none";
    game.style.display = "block";

    // --- 내 카드 표시 ---
    myCards.innerHTML = "";

    if (state.mustLoseCard) {
        myAreaTitle.textContent = "버릴 카드를 선택하세요!";
        myAreaTitle.style.color = "#e94560";

        state.myCards.forEach((role, index) => {
            const card = createCardElement(role, true, false);
            card.onclick = () => {
                socket.emit("lose_card", { cardIndex: index });
                myAreaTitle.textContent = "내 카드";
                myAreaTitle.style.color = "#eee";
            };
            myCards.appendChild(card);
        });
    } else {
        myAreaTitle.textContent = "내 카드";
        myAreaTitle.style.color = "#eee";

        state.myCards.forEach((role) => {
            const card = createCardElement(role, false, false);
            myCards.appendChild(card);
        });
    }

    // 내 죽은 카드도 표시
    if (state.myDeadCards) {
        state.myDeadCards.forEach((role) => {
            const card = createCardElement(role, false, true);
            myCards.appendChild(card);
        });
    }

    myCoins.textContent = state.myCoins;

    // --- 상대 플레이어 표시 ---
    renderOpponents();

    // --- 턴 정보 + 행동 버튼 ---
    if (state.isMyTurn && state.phase === "action") {
        turnInfo.textContent = "👉 내 차례입니다!";
        actionArea.style.display = "block";

        if (state.myCoins >= 10) {
            actionPrompt.textContent = "코인 10개 이상! 반드시 쿠데타를 해야 합니다.";
            document.querySelector(".btn-income").disabled = true;
            document.querySelector(".btn-foreign").disabled = true;
        } else {
            actionPrompt.textContent = "행동을 선택하세요";
            document.querySelector(".btn-income").disabled = false;
            document.querySelector(".btn-foreign").disabled = false;
        }

        coupBtn.disabled = state.myCoins < 7;

    } else if (state.mustLoseCard) {
        turnInfo.textContent = "⚠️ 버릴 카드를 선택하세요!";
        actionArea.style.display = "none";
    } else {
        turnInfo.textContent = `${state.currentTurn}의 차례`;
        actionArea.style.display = "none";
        selectingTarget = false;
    }
});

// ===== 상대 플레이어 렌더링 =====

function renderOpponents() {
    if (!currentState) return;
    const state = currentState;

    opponents.innerHTML = "";

    for (const [name, info] of Object.entries(state.players)) {
        if (name === myNickname) continue;

        const div = document.createElement("div");
        div.className = "player-info";

        if (name === state.currentTurn) {
            div.classList.add("current-turn");
        }
        if (!info.isAlive) {
            div.classList.add("eliminated");
        }

        if (selectingTarget && info.isAlive && !gameOver) {
            div.classList.add("targetable");
            div.onclick = () => {
                socket.emit("action", { action: "coup", target: name });
                selectingTarget = false;
                actionPrompt.textContent = "행동을 선택하세요";
            };
        }

        const nameTag = document.createElement("div");
        nameTag.textContent = name;
        nameTag.style.fontWeight = "bold";
        nameTag.style.marginBottom = "8px";
        div.appendChild(nameTag);

        // 살아있는 카드 — 뒷면으로 표시
        for (let i = 0; i < info.cardCount; i++) {
            const card = createCardElement("back", false, false);
            div.appendChild(card);
        }

        // 죽은 카드 — 앞면으로 공개 + 흑백 처리
        if (info.deadCards) {
            info.deadCards.forEach((role) => {
                const card = createCardElement(role, false, true);
                div.appendChild(card);
            });
        }

        const coinTag = document.createElement("div");
        coinTag.textContent = `코인: ${info.coins}개`;
        coinTag.style.marginTop = "8px";
        div.appendChild(coinTag);

        opponents.appendChild(div);
    }
}

// ===== 행동 함수들 =====

function doAction(action) {
    if (gameOver) return;
    socket.emit("action", { action: action });
}

function startCoup() {
    if (gameOver) return;
    selectingTarget = true;
    actionPrompt.textContent = "쿠데타 대상을 선택하세요 (상대 클릭)";
    renderOpponents();
}

// ===== 카드 요소 생성 =====
// selectable = 클릭 가능 여부 (카드 버리기용)
// dead = 죽은 카드 여부 (흑백 처리)
function createCardElement(role, selectable, dead) {
    const card = document.createElement("div");
    card.className = `card card-${role}`;

    if (selectable) {
        card.classList.add("card-selectable");
    }
    if (dead) {
        card.classList.add("card-dead");
    }

    const img = document.createElement("img");
    // 뒷면이면 card_back.png, 앞면이면 역할 이미지
    if (role === "back") {
        img.src = "/images/card_back.png";
    } else {
        img.src = `/images/${role}.png`;
    }
    img.style.width = "100%";
    img.style.height = "100%";
    img.style.objectFit = "cover";
    img.style.borderRadius = "8px";

    card.appendChild(img);

    // 뒷면이 아니면 역할 이름 표시
    if (role !== "back") {
        const label = document.createElement("div");
        label.textContent = roleNames[role];
        label.style.position = "absolute";
        label.style.bottom = "4px";
        label.style.width = "100%";
        label.style.fontSize = "12px";
        label.style.textShadow = "0 0 4px black";
        card.appendChild(label);
    }

    return card;
}

// ===== 게임 로그 =====
socket.on("action_log", (msg) => {
    const div = document.createElement("div");
    div.className = "log-msg";
    div.textContent = msg;
    logArea.appendChild(div);
    logArea.scrollTop = logArea.scrollHeight;
});

// ===== 게임 종료 =====
socket.on("game_over", (winner) => {
    gameOver = true;
    selectingTarget = false;

    const msg = winner === myNickname ? "🎉 승리!" : `${winner} 승리!`;
    turnInfo.textContent = msg;
    turnInfo.style.fontSize = "28px";
    actionArea.style.display = "none";

    // 상대 플레이어 영역 다시 그리기 (클릭 이벤트 제거)
    renderOpponents();

    const lobbyBtn = document.createElement("button");
    lobbyBtn.textContent = "로비로 돌아가기";
    lobbyBtn.className = "btn-lobby";
    lobbyBtn.onclick = () => {
        location.reload();
    };
    turnInfo.after(lobbyBtn);
});
// ===== 에러 =====
socket.on("error_msg", (msg) => {
    alert(msg);
});