// innerCoins.js

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "collectInnerCoins") {
        handleInnerCoinsCollection().then(res => sendResponse(res));
        return true;
    }
});

async function handleInnerCoinsCollection() {
    return new Promise((resolve) => {
        // מנקה זיכרון מריצות קודמות כדי להתחיל נקי לגמרי
        chrome.storage.local.remove([
            'matbehAli_resumeCollect', 
            'matbehAli_userStarted',
            'matbehAli_taskTime', 
            'matbehAli_clickedCount',
            'matbehAli_passCount',
            'matbehAli_activeTabId'
        ], () => {
            // פותח את החלון באותה צורה מקורית
            chrome.windows.create({
                url: "https://m.aliexpress.com/p/coin-index/index.html",
                type: "popup",
                width: 412,
                height: 800
            }, (win) => {
                const tabId = win.tabs[0].id;
                
                // שמירת מזהה הטאב כדי שאם המשתמש יסגור אותו ידנית, ננקה את הנתונים
                chrome.storage.local.set({ matbehAli_activeTabId: tabId });

                // ממתין 6 שניות ואז שולח הודעה שמקפיצה את כפתור ההתחלה
                setTimeout(() => {
                    chrome.tabs.sendMessage(tabId, { action: "startAutoCollect" }, () => {
                        resolve({ status: "SUCCESS", message: "נפתח חלון, ממתין לאישור התחלה..." });
                    });
                }, 6000); 
            });
        });
    });
}