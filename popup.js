document.addEventListener("DOMContentLoaded", async () => {
    const statusIcon = document.getElementById("statusIcon");
    const lastCollectedTime = document.getElementById("lastCollectedTime");
    const lastRunTime = document.getElementById("lastRunTime");
    const lastRunStatus = document.getElementById("lastRunStatus");
    const updateBanner = document.getElementById("updateBanner"); // קריאה לבאנר
    
    const btnRun = document.getElementById("btnRun");
    const btnTrivia = document.getElementById("btnTrivia");
    const btnSettings = document.getElementById("btnSettings");

    async function loadDataAndCheckStatus() {
        statusIcon.className = "status-badge";
        statusIcon.textContent = "⏳";
        statusIcon.title = "בודק סטטוס...";

        const storage = await chrome.storage.local.get([
            "lastCollectedTime",
            "lastRunTime",
            "lastRunStatus",
            "hasGitHubUpdate"
        ]);

        lastCollectedTime.textContent = storage.lastCollectedTime || "טרם בוצע";
        lastRunTime.textContent = storage.lastRunTime || "טרם בוצע";
        lastRunStatus.textContent = storage.lastRunStatus || "לא ידוע";

        // הצגת הבאנר אם יש עדכון ושינוי הכיתוב למבנה של דף ההגדרות
        if (storage.hasGitHubUpdate) {
            updateBanner.style.display = "block";
            
            const updateLink = updateBanner.querySelector("a");
            const currentVersion = chrome.runtime.getManifest().version;
            
            // שליפת הגרסה העדכנית מגיטהאב כדי להציג אותה בכיתוב
            fetch("https://raw.githubusercontent.com/Tzadikvtovlo/MatbehAli/main/manifest.json")
                .then(res => res.json())
                .then(data => {
                    updateLink.textContent = `יש עדכון!   מותקן: v${currentVersion} | זמין: v${data.version}`;
                    updateLink.title = "לחץ כאן להורדה";
                }).catch(() => {
                    // גיבוי במקרה של שגיאת רשת
                    updateLink.textContent = "יש גרסה חדשה! לחץ כאן להורדה";
                });
                
        } else {
            updateBanner.style.display = "none";
        }

        chrome.runtime.sendMessage({ action: "getAccountInfo" }, (res) => {
            const isConnected = res?.isConnected;
            const hasUpdate = storage.hasGitHubUpdate;

            statusIcon.className = "status-badge";

            if (!isConnected) {
                statusIcon.classList.add("status-disconnected");
                statusIcon.textContent = "✕";
                statusIcon.title = "לא מחובר לחשבון";
            } else if (hasUpdate) {
                statusIcon.classList.add("status-update");
                statusIcon.textContent = "!";
                statusIcon.title = "עדכון זמין בדף ההגדרות";
            } else {
                statusIcon.classList.add("status-connected");
                statusIcon.textContent = "✓";
                statusIcon.title = "מחובר לחשבון";
            }
        });
    }

    statusIcon.addEventListener("click", () => {
        loadDataAndCheckStatus();
    });

    btnRun.addEventListener("click", () => {
        btnRun.disabled = true;
        btnRun.textContent = "מריץ...";
        chrome.runtime.sendMessage({ action: "collectCoins" }, () => {
            setTimeout(() => {
                btnRun.disabled = false;
                btnRun.textContent = "הרץ מחדש";
                loadDataAndCheckStatus();
            }, 1000);
        });
    });

    btnTrivia.addEventListener("click", () => {
        btnTrivia.disabled = true;
        btnTrivia.textContent = "אוסף...";
        
        chrome.runtime.sendMessage({ action: "collectInnerCoins" }, (response) => {
            btnTrivia.textContent = response?.message || "בוצע";
            setTimeout(() => {
                btnTrivia.disabled = false;
                btnTrivia.textContent = "איסוף מטבעות בונוס";
                loadDataAndCheckStatus(); 
            }, 2000);
        });
    });

    btnSettings.addEventListener("click", () => {
        if (chrome.runtime.openOptionsPage) {
            chrome.runtime.openOptionsPage();
        } else {
            window.open(chrome.runtime.getURL("options.html"));
        }
    });

    loadDataAndCheckStatus();
});
