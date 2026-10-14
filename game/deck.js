// deck.js — 카드 덱 관련 함수만 모아둔 파일

// 카드 덱 생성 (5종류 × 3장 = 15장)
function makeDeck() {
    const roles = ["duke", "assassin", "captain", "contessa", "ambassador"];
    const deck = [];
    for (const role of roles) {
        for (let i = 0; i < 3; i++) {
            deck.push(role);
        }
    }
    return deck;
}

// 배열을 랜덤으로 섞기 (Fisher-Yates 알고리즘)
function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

// 이 파일에서 사용할 함수들을 내보내기
// 다른 파일에서 require("./deck")하면 이것들을 쓸 수 있음
module.exports = { makeDeck, shuffle };