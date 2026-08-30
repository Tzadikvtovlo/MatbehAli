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

                // במקום לחכות 6 שניות בצורה עיוורת, נשאל את הדף כל שנייה וחצי אם הוא מוכן
                let attempts = 0;
                const maxAttempts = 20; // יחכה בסבלנות עד 30 שניות במצטבר לטעינת הדף
                
                const tryStartInterval = setInterval(() => {
                    attempts++;
                    chrome.tabs.sendMessage(tabId, { action: "startAutoCollect" }, (response) => {
                        if (!chrome.runtime.lastError && response && response.status === "SUCCESS") {
                            // הדף נטען לחלוטין וענה לנו!
                            clearInterval(tryStartInterval);
                            resolve({ status: "SUCCESS", message: "החלון נטען, מתחיל סריקה..." });
                        } else if (attempts >= maxAttempts) {
                            // עבר חצי דקה והדף סירב להיטען כראוי
                            clearInterval(tryStartInterval);
                            resolve({ status: "FAILED", message: "הטעינה התעכבה, נסה שוב." });
                        }
                    });
                }, 1500); 
            });
        });
    });
}
