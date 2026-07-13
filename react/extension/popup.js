document.addEventListener('DOMContentLoaded', function () {
    const btn = document.getElementById("collectBtn");

    if (!btn) {
        console.error("오류: 버튼을 찾을 수 없습니다.");
        return;
    }

    btn.addEventListener("click", async () => {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

        if (!tab.url.includes("youtube.com")) {
            alert("유튜브 시청기록 페이지에서 실행해주세요! (https://www.youtube.com/feed/history)");
            return;
        }

        // 1. 스크립트 실행 (비디오 ID 수집)
        chrome.scripting.executeScript({
            target: { tabId: tab.id },
            function: scrapeVideoIds,
        }, async (results) => {
            if (chrome.runtime.lastError) {
                console.error("실행 에러:", chrome.runtime.lastError);
                alert("수집 중 에러가 발생했습니다: " + chrome.runtime.lastError.message);
                return;
            }

            if (results && results[0] && results[0].result) {
                const collectedIds = results[0].result;
                console.log(`Algo.Analyzer: 본부 수신 완료 (${collectedIds.length}개).`);

                // 데이터를 클립보드에 복사
                const jsonText = JSON.stringify(collectedIds);
                
                // 임시 textarea를 생성하여 복사 실행 (가장 확실한 방법)
                const tempTextArea = document.createElement("textarea");
                tempTextArea.value = jsonText;
                document.body.appendChild(tempTextArea);
                tempTextArea.select();
                document.execCommand("copy");
                document.body.removeChild(tempTextArea);

                alert(`🎉 유튜브 시청 기록 ${collectedIds.length}개 수집 및 복사 완료!\n\n대시보드 페이지(http://localhost:3000)의 '데이터 붙여넣기' 창에 붙여넣어 주세요.`);
            } else {
                alert("화면에서 유튜브 비디오 링크를 찾지 못했습니다. 유튜브 시청기록 페이지를 스크롤한 뒤 다시 시도해 주세요.");
            }
        });
    });
});

// 유튜브 페이지에서 실행될 수집 함수
function scrapeVideoIds() {
    const allLinks = document.querySelectorAll('a');
    const videoIds = new Set();

    allLinks.forEach((link) => {
        const href = link.href;
        if (!href) return;

        try {
            if (href.includes('/watch?v=')) {
                const id = new URL(href).searchParams.get('v');
                if (id && id.length > 5) videoIds.add(id);
            } else if (href.includes('/shorts/')) {
                const id = href.split('/shorts/')[1]?.split('?')[0];
                if (id && id.length > 5) videoIds.add(id);
            }
        } catch (e) { }
    });

    return Array.from(videoIds).slice(0, 500); // 500개로 한정
}