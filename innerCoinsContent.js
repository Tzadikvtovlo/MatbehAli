// innerCoinsContent.js

// --- זיוף עמוק של מכשיר נייד (חובה להריץ לפני הכל) ---
function spoofMobileJS() {
    const script = document.createElement('script');
    script.textContent = `
        try {
            Object.defineProperty(navigator, 'userAgent', { get: () => "Mozilla/5.0 (Linux; Android 13; Pixel 7 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36" });
            Object.defineProperty(navigator, 'platform', { get: () => "Linux armv8l" });
            Object.defineProperty(navigator, 'vendor', { get: () => "Google Inc." });
            Object.defineProperty(navigator, 'maxTouchPoints', { get: () => 5 });
        } catch(e) {}
    `;
    if (document.documentElement) {
        document.documentElement.appendChild(script);
        script.remove();
    }
}
// מריץ את הזיוף באופן מיידי לפני טעינת שאר האתר
spoofMobileJS();

const DELAY_TASK = 16000; 
const MAX_PASSES = 5; // הועלה ל-5 סבבי סריקה להבטחת איסוף מלא
const MAX_RETRIES_DRAWER = 25; 

const delay = ms => new Promise(res => setTimeout(res, ms));
window.isClickerRunning = false; 

function injectMatbehStyles() {
    if (document.getElementById('matbehAli-styles')) return;
    const style = document.createElement('style');
    style.id = 'matbehAli-styles';
    style.innerHTML = `
        .matbeh-font {
            font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif !important;
            direction: rtl !important;
        }
        .matbeh-icon {
            display: flex;
            align-items: center;
            justify-content: center;
            margin-left: 8px;
        }
    `;
    (document.head || document.documentElement).appendChild(style);
}

// מחרוזות של האייקונים החדשים (SVG) בצבע האדום של התוסף (#D32F2F)
const ICONS = {
    SUCCESS: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#D32F2F" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`,
    WAIT: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#D32F2F" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>`,
    PASS: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#D32F2F" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>`,
    INFO: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#D32F2F" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`
};

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "startAutoCollect") {
        injectMatbehStyles();
        chrome.storage.local.set({
            matbehAli_resumeCollect: true,
            matbehAli_clickedCount: 0,
            matbehAli_passCount: 1,
            matbehAli_taskTime: 0
        }, async () => {
            sendResponse({ status: "SUCCESS" });
            showIndicator("הדף נטען! מתכונן לאיסוף...", "SUCCESS");
            
            // המתנה מוגדלת של 5 שניות לפני תחילת העבודה
            await delay(5000);
            
            if (!window.isClickerRunning) runAutoClicker();
        });
        return true;
    }
});

window.addEventListener('load', () => {
    if (window.innerWidth > 600) return;
    
    injectMatbehStyles();

    chrome.storage.local.get(null, (state) => {
        if (!state.matbehAli_resumeCollect) return;

        const isCoinPage = window.location.href.includes('coin');

        if (!isCoinPage) {
            const startTime = parseInt(state.matbehAli_taskTime || Date.now());
            const elapsed = Date.now() - startTime;
            const remaining = Math.max(0, DELAY_TASK - elapsed);
            let timeLeft = Math.ceil(remaining / 1000);
            
            const indicator = showIndicator(`מבצע משימה... ממתין ${timeLeft} שניות`, "WAIT");
            
            const timer = setInterval(() => {
                timeLeft--;
                if (timeLeft > 0) {
                    if (indicator) indicator.innerHTML = `<span class="matbeh-icon">${ICONS.WAIT}</span><span>מבצע משימה... ממתין ${timeLeft} שניות</span>`;
                } else {
                    clearInterval(timer);
                    if (indicator) {
                        indicator.style.background = "#FFFBE6";
                        indicator.style.color = "#111827";
                        indicator.style.borderColor = "#FFD700";
                        indicator.innerHTML = `<span class="matbeh-icon">${ICONS.SUCCESS}</span><span>מסיים משימה וחוזר...</span>`;
                    }
                    setTimeout(() => {
                        window.location.href = "https://m.aliexpress.com/p/coin-index/index.html";
                    }, 1500);
                }
            }, 1000);
        } else {
            if (state.matbehAli_taskTime > 0) {
                chrome.storage.local.set({ matbehAli_taskTime: 0 });
                showIndicator("חוזר להמשך סריקה...", "SUCCESS");
                
                // המתנה מוגדלת גם כשחוזרים ממשימה
                setTimeout(() => {
                    if (!window.isClickerRunning) runAutoClicker();
                }, 5000);
            }
        }
    });
});

function showIndicator(text, themeType) {
    let bgColor, textColor, borderColor, svgIcon;
    
    // שימוש אך ורק בצבעים הרשמיים של התוסף
    if (themeType === "SUCCESS") {
        bgColor = "#FFFBE6"; textColor = "#111827"; borderColor = "#FFD700"; svgIcon = ICONS.SUCCESS;
    } else if (themeType === "WAIT") {
        bgColor = "#FFFFFF"; textColor = "#D32F2F"; borderColor = "#FFD700"; svgIcon = ICONS.WAIT;
    } else if (themeType === "PASS") {
        bgColor = "#FFF066"; textColor = "#111827"; borderColor = "#FFD700"; svgIcon = ICONS.PASS;
    } else { 
        bgColor = "#FFFFFF"; textColor = "#4b5563"; borderColor = "#FFD700"; svgIcon = ICONS.INFO;
    }

    let el = document.getElementById('matbehAli-indicator');
    if (!el) {
        el = document.createElement('div');
        el.id = 'matbehAli-indicator';
        el.className = 'matbeh-font';
        if (document.body) document.body.appendChild(el);
    }
    
    el.innerHTML = `<span class="matbeh-icon">${svgIcon}</span><span>${text}</span>`;
    
    el.style.cssText = `
        position: fixed; top: 15px; left: 50%; transform: translateX(-50%);
        background: ${bgColor}; color: ${textColor}; border: 1px solid ${borderColor};
        padding: 10px 20px; z-index: 2147483647; border-radius: 8px; font-weight: 600;
        box-shadow: 0 4px 12px rgba(0,0,0,0.08); display: flex; align-items: center; justify-content: center;
        font-size: 14px; pointer-events: none; width: auto; max-width: 90%; white-space: nowrap;
        transition: all 0.3s ease;
    `;
    
    el.style.display = 'flex';
    return el;
}

function findInnerElementsWithText(tags, validTexts) {
    const elements = Array.from(document.querySelectorAll(tags)).filter(el => {
        const txt = el.textContent.trim().toLowerCase();
        return validTexts.some(t => txt.includes(t));
    });
    
    return elements.filter(el => {
        const hasInnerMatch = Array.from(el.children).some(child => {
            const childTxt = child.textContent.trim().toLowerCase();
            return validTexts.some(t => childTxt.includes(t));
        });
        
        const isVisible = el.offsetWidth > 0 && el.offsetHeight > 0;
        return !hasInnerMatch && isVisible;
    });
}

const getTaskButtons = () => {
    const words = ['go', 'collect', 'claim', 'בצע', 'קבל', 'to finish', 'browse'];
    return findInnerElementsWithText('div, button, span, a', words)
        .filter(btn => !btn.classList.contains('matbeh-ali-ignored'));
};

async function openTaskDrawerWithRetries() {
    let clickedDrawer = false;

    for (let attempt = 1; attempt <= MAX_RETRIES_DRAWER; attempt++) {
        let visibleTaskButtons = getTaskButtons();
        if (visibleTaskButtons.length > 0) return true;

        if (!clickedDrawer) {
            let openTasksBtns = findInnerElementsWithText('button, div, span, p', ['earn more coins', 'get more coins', 'get more', 'הרווח עוד', 'more coins']);
            
            if (openTasksBtns.length > 0) {
                let targetBtn = openTasksBtns[openTasksBtns.length - 1]; 
                targetBtn.click();
                clickedDrawer = true;
                showIndicator("פותח משימות, ממתין לטעינה...", "WAIT");
                await delay(3000); 
                continue; 
            }
        }
        
        showIndicator(`מחפש משימות... (ניסיון ${attempt}/${MAX_RETRIES_DRAWER})`, "WAIT");
        await delay(1000);
    }
    return false;
}

async function runAutoClicker() {
    if (window.isClickerRunning) return;
    window.isClickerRunning = true;

    let state = await new Promise(r => chrome.storage.local.get(null, r));
    let clickedCount = parseInt(state.matbehAli_clickedCount || "0");
    let passCount = parseInt(state.matbehAli_passCount || "1");

    let drawerOpen = await openTaskDrawerWithRetries();
    if (!drawerOpen) {
        showIndicator("לא מצאתי עוד משימות להיום.", "PASS");
        await delay(3000);
        await finishExecution(clickedCount);
        return;
    }

    while (passCount <= MAX_PASSES) {
        showIndicator(`סורק משימות: סיבוב ${passCount} מתוך ${MAX_PASSES}...`, "PASS");
        await delay(2500);
        
        let taskButtons = getTaskButtons();
        
        for (let i = 0; i < taskButtons.length; i++) {
            let btn = taskButtons[i];
            let btnText = btn.textContent.trim().toLowerCase();
            let isCollect = ['collect', 'claim', 'קבל'].some(w => btnText.includes(w));
            
            if (btn.disabled || btn.offsetParent === null) continue;

            if (isCollect) {
                btn.click();
                clickedCount++;
                await new Promise(r => chrome.storage.local.set({ matbehAli_clickedCount: clickedCount }, r));
                
                showIndicator(`אספתי מטבע! מתקדם...`, "SUCCESS");
                await delay(2500); 

                if (btn.offsetParent !== null && !btn.disabled) {
                    btn.classList.add('matbeh-ali-ignored'); 
                }
                
                taskButtons = getTaskButtons(); 
                i = -1; 
            } 
            else { 
                await new Promise(r => chrome.storage.local.set({ matbehAli_taskTime: Date.now(), matbehAli_passCount: passCount }, r));
                btn.click();
                
                showIndicator(`נכנס למשימה...`, "WAIT");
                
                await delay(4000); 
                
                await new Promise(r => chrome.storage.local.set({ matbehAli_taskTime: 0 }, r)); 
                
                if (btn.offsetParent !== null && !btn.disabled) {
                    btn.classList.add('matbeh-ali-ignored'); 
                    showIndicator(`המשימה לא נפתחה, מדלג לבאה...`, "WAIT");
                    await delay(1000);
                }

                taskButtons = getTaskButtons();
                i = -1;
            }
        }
        
        passCount++;
        await new Promise(r => chrome.storage.local.set({ matbehAli_passCount: passCount }, r));
    }

    await finishExecution(clickedCount);
}

async function finishExecution(clickedCount) {
    chrome.storage.local.remove([
        'matbehAli_resumeCollect', 
        'matbehAli_userStarted',
        'matbehAli_taskTime', 
        'matbehAli_clickedCount',
        'matbehAli_passCount',
        'matbehAli_activeTabId'
    ]);
    
    showIndicator(`סיימתי הכל! (${clickedCount} פעולות). סוגר את החלון...`, "SUCCESS");
    
    setTimeout(() => {
        window.close();
    }, 3500);
}
