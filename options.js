document.addEventListener("DOMContentLoaded", () => {
    const currentVersion = chrome.runtime.getManifest().version;
    const versionDisplay = document.getElementById("version-display");
    if (versionDisplay) {
        versionDisplay.textContent = `v ${currentVersion}`;
    }

    const statusEl = document.getElementById("account-status");
    const usernameEl = document.getElementById("account-username");
    const btnLogin = document.getElementById("btn-login");
    const runTimeEl = document.getElementById("opt-last-run-time");
    const runStatusEl = document.getElementById("opt-last-run-status");
    const collectedTimeEl = document.getElementById("opt-last-collected-time");
    const noCollectTimeEl = document.getElementById("opt-last-nocollect-time");
    const failTimeEl = document.getElementById("opt-last-fail-time");
    
    const chkIconReplace = document.getElementById("chkIconReplace");
    const chkIconBadge = document.getElementById("chkIconBadge");

    chrome.storage.local.get(["iconDisplayReplace", "iconDisplayBadge"], (res) => {
        chkIconReplace.checked = res.iconDisplayReplace !== false; 
        chkIconBadge.checked = res.iconDisplayBadge === true; 

        const saveAndTriggerIconCheck = () => {
            chrome.storage.local.set({ 
                iconDisplayReplace: chkIconReplace.checked,
                iconDisplayBadge: chkIconBadge.checked
            }, () => {
                chrome.runtime.sendMessage({ action: "checkAndUpdateIcon" });
            });
        };

        chkIconReplace.addEventListener("change", saveAndTriggerIconCheck);
        chkIconBadge.addEventListener("change", saveAndTriggerIconCheck);
    });

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

    document.getElementById("btn-check-connection").addEventListener("click", loadAccountInfo);

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

    async function performUpdateCheck(displayElement, originalText, isSilent = false) {
        if (!isSilent) displayElement.textContent = "בודק...";
        try {
            const res = await fetch("https://raw.githubusercontent.com/Tzadikvtovlo/MatbehAli/main/manifest.json");
            if (!res.ok) throw new Error("Network error");
            const data = await res.json();
            
            const latestVersion = data.version;
            
            if (parseFloat(latestVersion) > parseFloat(currentVersion)) {
                // יש עדכון: שינוי הטקסט, שינוי הטולטיפ, והפעלת האנימציה
                displayElement.textContent = `מותקן: v${currentVersion} | זמין: v${latestVersion}`;
                displayElement.title = "לחץ כאן להורדה";
                displayElement.classList.add("update-available-pulse");
                
                chrome.storage.local.set({ hasGitHubUpdate: true }, () => {
                    chrome.runtime.sendMessage({ action: "checkAndUpdateIcon" });
                });
            } else {
                // אין עדכון: החזרת הטולטיפ הרגיל וכיבוי האנימציה
                displayElement.title = "לחץ לבדיקת עדכונים";
                displayElement.classList.remove("update-available-pulse");
                
                if (!isSilent) displayElement.textContent = "אתה מעודכן";
                chrome.storage.local.set({ hasGitHubUpdate: false }, () => {
                    chrome.runtime.sendMessage({ action: "checkAndUpdateIcon" });
                });
                if (!isSilent) {
                    setTimeout(() => {
                        displayElement.textContent = originalText;
                    }, 10000);
                }
            }
        } catch (e) {
            if (!isSilent) {
                displayElement.textContent = "שגיאה בבדיקה";
                setTimeout(() => { displayElement.textContent = originalText; }, 3000);
            }
        }
    }

    if (versionDisplay) {
        // מנגנון חכם: אם יש עדכון, לחיצה פותחת את דף ההורדה. אם לא - היא מריצה בדיקה
        versionDisplay.onclick = () => {
            if (versionDisplay.classList.contains("update-available-pulse")) {
                window.open("https://github.com/Tzadikvtovlo/MatbehAli", '_blank');
            } else {
                performUpdateCheck(versionDisplay, `v ${currentVersion}`, false);
            }
        };
        
        // הרצה אוטומטית כשהדף נטען
        performUpdateCheck(versionDisplay, `גירסא ${currentVersion}`, true);
    }

    const btnLittleDetails = document.getElementById("btn-little-details");
    btnLittleDetails.addEventListener("click", () => {
        btnLittleDetails.disabled = true;
        btnLittleDetails.textContent = "אוסף...";
        
        chrome.runtime.sendMessage({ action: "collectInnerCoins" }, (response) => {
            btnLittleDetails.textContent = response?.message || "בוצע";
            setTimeout(() => {
                btnLittleDetails.disabled = false;
                btnLittleDetails.textContent = "איסוף מטבעות בונוס";
            }, 2000);
        });
    });

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
