document.addEventListener("DOMContentLoaded", () => {
    const statusEl = document.getElementById("account-status");
    const usernameEl = document.getElementById("account-username");
    const btnLogin = document.getElementById("btn-login");
    const runTimeEl = document.getElementById("opt-last-run-time");
    const runStatusEl = document.getElementById("opt-last-run-status");
    const collectedTimeEl = document.getElementById("opt-last-collected-time");
    const noCollectTimeEl = document.getElementById("opt-last-nocollect-time");
    const failTimeEl = document.getElementById("opt-last-fail-time");
    
    function loadAccountInfo() {
        statusEl.textContent = "בודק...";
        usernameEl.textContent = "בודק...";
        usernameEl.style.display = "inline";
        if (btnLogin) btnLogin.style.display = "none";
        
        chrome.runtime.sendMessage({ action: "getAccountInfo" }, (response) => {
            if (response && response.isConnected) {
                statusEl.textContent = "מחובר";
                statusEl.style.color = "#111827"; 
                usernameEl.textContent = response.username || "מחובר"; 
                usernameEl.style.display = "inline";
                if (btnLogin) btnLogin.style.display = "none";
            } else {
                statusEl.textContent = "לא מחובר";
                statusEl.style.color = "#D32F2F"; 
                usernameEl.style.display = "none";
                if (btnLogin) btnLogin.style.display = "inline-block";
            }
        });
    }

    function loadHistory() {
        chrome.storage.local.get([
            "lastRunTime", "lastRunStatus",
            "lastCollectedTime", "lastNoCollectTime", "lastFailTime"
        ], data => {
            runTimeEl.textContent = data.lastRunTime || "טרם בוצעה ריצה";
            runStatusEl.textContent = data.lastRunStatus || "אין נתונים";
            collectedTimeEl.textContent = data.lastCollectedTime || "אין מידע";
            noCollectTimeEl.textContent = data.lastNoCollectTime || "אין מידע";
            failTimeEl.textContent = data.lastFailTime || "אין מידע";
        });
    }

    loadAccountInfo();
    loadHistory();

    // לחצן רענון בדיקת חיבור
    document.getElementById("btn-check-connection").addEventListener("click", loadAccountInfo);

    // לחצן הרץ מחדש
    const btnRerun = document.getElementById("btn-rerun");
    btnRerun.addEventListener("click", () => {
        btnRerun.disabled = true;
        btnRerun.textContent = "רץ...";
        chrome.runtime.sendMessage({ action: "collectCoins" }, (response) => {
            loadHistory();
            btnRerun.disabled = false;
            btnRerun.textContent = "הרץ מחדש";
        });
    });

    // לחצן בדיקת עדכונים
    const btnUpdates = document.getElementById("btn-check-updates");
    btnUpdates.addEventListener("click", async () => {
        const currentVersion = chrome.runtime.getManifest().version;
        btnUpdates.textContent = "בודק...";
        try {
            const res = await fetch("https://api.github.com/repos/Tzadikvtovlo/MatbehAli/releases/latest");
            if (!res.ok) throw new Error("Network error");
            const data = await res.json();
            
            const latestVersion = data.tag_name ? data.tag_name.replace('v', '') : currentVersion;
            
            if (parseFloat(latestVersion) > parseFloat(currentVersion)) {
                btnUpdates.textContent = `גירסה ${latestVersion} זמינה`;
                btnUpdates.onclick = () => window.open(data.html_url, '_blank');
            } else {
                btnUpdates.textContent = "אתה מעודכן";
                setTimeout(() => {
                    btnUpdates.textContent = "בדיקת עדכונים";
                }, 15000);
            }
        } catch (e) {
            btnUpdates.textContent = "שגיאה בבדיקה";
            setTimeout(() => { btnUpdates.textContent = "בדיקת עדכונים"; }, 3000);
        }
    });

    // לחצן פכים קטנים
    document.getElementById("btn-little-details").addEventListener("click", () => {
        // שומרים ריק להמשך
    });

    // העתקת אימייל ללוח
    const copyEmail = document.getElementById("copy-email");
    const emailContainer = document.getElementById("email-container");
    copyEmail.addEventListener("click", () => {
        navigator.clipboard.writeText("q9411aa@gmail.com").then(() => {
            emailContainer.classList.add("show-tooltip");
            setTimeout(() => {
                emailContainer.classList.remove("show-tooltip");
            }, 2000);
        });
    });
});