importScripts("crypto-js.min.js", "innerCoins.js");

let isCollecting = false;
const ALARM_NAME = "hourlyCoinCollection";

async function updateIcon(statusType) {
    const storage = await chrome.storage.local.get(["iconDisplayReplace", "iconDisplayBadge"]);
    // ברירת מחדל: שינוי תמונה דלוק, סמלון כבוי
    const useReplace = storage.iconDisplayReplace !== false;
    const useBadge = storage.iconDisplayBadge === true;

    let iconPrefix = "ICON";
    let badgeText = "";

    // שימוש בתווים סטנדרטיים במקום אימוג'י - כדי למנוע חסימה של הלוגו
    switch (statusType) {
        case "CHECKING":
            iconPrefix = "ICON";
            badgeText = "•"; // נקודה קטנה מסמלת טעינה/בדיקה
            break;
        case "DISCONNECTED":
        case "FAILED":
            iconPrefix = "DICON";
            badgeText = "X";
            break;
        case "UPDATE_AVAILABLE":
            iconPrefix = "NICON";
            badgeText = "!";
            break;
        case "NEEDS_COLLECTION":
            iconPrefix = "ICON";
            badgeText = "?";
            break;
        case "SUCCESS":
            iconPrefix = "ICON";
            badgeText = "";
            break;
    }

    // 1. קביעת הלוגו המרכזי
    const finalPrefix = useReplace ? iconPrefix : "ICON";
    chrome.action.setIcon({
        path: {
            "16": `images/${finalPrefix}16.png`,
            "48": `images/${finalPrefix}48.png`,
            "128": `images/${finalPrefix}128.png`
        }
    });

    // 2. קביעת סמלון ההתרעה
    const finalBadge = useBadge ? badgeText : "";
    chrome.action.setBadgeText({ text: finalBadge });
    
    // רקע שקוף לחלוטין (כעת יעבוד מושלם בזכות הסרת האימוג'י)
    chrome.action.setBadgeBackgroundColor({ color: [0, 0, 0, 0] });
    
    // צביעת הטקסט עצמו באדום הנוכח (נתמך בגרסאות כרום מתקדמות)
    try {
        chrome.action.setBadgeTextColor({ color: "#D32F2F" });
    } catch(e) {}
}

async function checkForUpdates() {
    try {
        const currentVersion = chrome.runtime.getManifest().version;
        const res = await fetch("https://raw.githubusercontent.com/Tzadikvtovlo/MatbehAli/main/manifest.json");
        if (!res.ok) return;
        const data = await res.json();
        const latestVersion = data.version;
        
        if (parseFloat(latestVersion) > parseFloat(currentVersion)) {
            await chrome.storage.local.set({ hasGitHubUpdate: true });
        } else {
            await chrome.storage.local.set({ hasGitHubUpdate: false });
        }
    } catch (e) {
        // התעלמות משגיאות
    }
}

async function checkAndUpdateIconStatus(accountInfo = null) {
    const storage = await chrome.storage.local.get(["hasGitHubUpdate", "lastSuccessMs"]);
    if (!accountInfo) {
        accountInfo = await getAccountInfo();
    }
    
    const TWENTY_HOURS_MS = 20 * 60 * 60 * 1000;
    let needsCollection = false;
    
    if (storage.lastSuccessMs) {
        if (Date.now() - storage.lastSuccessMs > TWENTY_HOURS_MS) {
            needsCollection = true;
        }
    } else {
        needsCollection = true; 
    }

    if (!accountInfo.isConnected) {
        await updateIcon("DISCONNECTED");
    } else if (storage.hasGitHubUpdate) {
        await updateIcon("UPDATE_AVAILABLE");
    } else if (needsCollection) {
        await updateIcon("NEEDS_COLLECTION");
    } else {
        await updateIcon("SUCCESS");
    }
}

async function triggerCoinCollection(manual = false) {
    if (isCollecting) return { status: "RUNNING", message: "רץ-כעת..." };
    isCollecting = true;
    
    await updateIcon("CHECKING");

    try {
        const result = await fetchCoins();
        const timeString = new Date().toLocaleString('he-IL');
        const updates = { lastRunTime: timeString };

        if (result.error) {
            let reason = "שגיאה כללית";
            if (result.error.includes("נא התחברו") || result.error.includes("EXPIRED") || result.error.includes("עוגיית אימות")) {
                reason = "לא מחובר לחשבון";
            } else if (result.error.includes("שגיאת רשת") || result.error.includes("timeout")) {
                reason = "אין אינטרנט";
            } else {
                reason = result.error;
            }
            
            updates.lastRunStatus = "נכשל: " + reason;
            updates.lastFailTime = timeString;
            updates.lastFailReason = reason;
            await chrome.storage.local.set(updates);
            
            await checkAndUpdateIconStatus();
            return { status: "FAILED", message: updates.lastRunStatus };
        }

        const data = result?.data?.data;

        if (data?.signSuccess) {
            updates.lastRunStatus = "אסף בהצלחה";
            updates.lastCollectedTime = timeString;
            updates.lastSuccessMs = Date.now(); 
            await chrome.storage.local.set(updates);
            await checkAndUpdateIconStatus();
            return { status: "COLLECTED", message: "אסף בהצלחה" };
            
        } else if (data?.todayAlreadySign) {
            updates.lastRunStatus = "אין איסוף זמין";
            updates.lastNoCollectTime = timeString;
            updates.lastSuccessMs = Date.now(); 
            await chrome.storage.local.set(updates);
            await checkAndUpdateIconStatus();
            return { status: "NO_COLLECT", message: "אין איסוף זמין" };
            
        } else {
            const errorMsg = result?.ret?.[0] || "שגיאה לא ידועה מהשרת.";
            updates.lastRunStatus = "נכשל: " + errorMsg;
            updates.lastFailTime = timeString;
            updates.lastFailReason = errorMsg;
            
            await chrome.storage.local.set(updates);
            await checkAndUpdateIconStatus();
            return { status: "FAILED", message: updates.lastRunStatus };
        }
    } catch (e) {
        await chrome.storage.local.set({ 
            lastRunTime: new Date().toLocaleString('he-IL'),
            lastRunStatus: "נכשל: " + e.message,
            lastFailTime: new Date().toLocaleString('he-IL'), 
            lastFailReason: e.message 
        });
        await checkAndUpdateIconStatus();
        return { status: "FAILED", message: "נכשל: " + e.message };
    } finally {
        isCollecting = false;
    }
}

chrome.runtime.onInstalled.addListener(() => {
    chrome.alarms.create(ALARM_NAME, { periodInMinutes: 60 });
    checkForUpdates().then(() => {
        checkAndUpdateIconStatus().then(() => triggerCoinCollection());
    });
});

chrome.runtime.onStartup.addListener(() => {
    checkForUpdates().then(() => {
        checkAndUpdateIconStatus().then(() => triggerCoinCollection());
    });
});

chrome.alarms.onAlarm.addListener(alarm => {
    if (alarm.name === ALARM_NAME) triggerCoinCollection();
});

const MOBILE_UA = "Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Mobile Safari/537.36";
const delay = t => new Promise(e => setTimeout(e, t));

async function getBrowserToken(){
    return new Promise(async (t,e)=>{
        try {
            let cookies = await chrome.cookies.getAll({ domain: "aliexpress.com" });
            let tkCookie = cookies.find(c => c.name === "_m_h5_tk");
            
            if (!tkCookie || !tkCookie.value) {
                await fetch("https://m.aliexpress.com/", {credentials: "include", headers: {"user-agent": MOBILE_UA}});
                cookies = await chrome.cookies.getAll({ domain: "aliexpress.com" });
                tkCookie = cookies.find(c => c.name === "_m_h5_tk");
            }
            
            if (tkCookie && tkCookie.value) {
                const s = tkCookie.value.split("_")[0]; 
                t(s);
            } else {
                e(new Error("לא נמצאה עוגיית אימות. יש להתחבר לחשבון AliExpress."));
            }
        } catch (err) {
            e(err);
        }
    });
}

async function verifyRealConnectionViaAPI(token) {
    try {
        const a = Date.now();
        const u = "24815441";
        const i = JSON.stringify({ playCode: "productSignInCoinChannel" });
        const f = CryptoJS.MD5(`${token}&${a}&${u}&${i}`).toString();
        const g = new URL("https://acs.aliexpress.com/h5/mtop.aliexpress.coin.channel.sign.execute/1.0/");
        g.search = new URLSearchParams({
            appKey: u, t: a, sign: f, api: "mtop.aliexpress.coin.channel.sign.execute", v: "1.0", type: "originaljson", dataType: "jsonp"
        }).toString();
        
        const c = await fetch(g, {
            method: "POST",
            headers: { "content-type": "application/x-www-form-urlencoded", "user-agent": MOBILE_UA },
            body: new URLSearchParams({data:i}), credentials: "include"
        });
        
        const p = await c.text();
        const m = p.match(/.*\((.*)\)/);
        const d = m&&m[1] ? JSON.parse(m[1]) : JSON.parse(p);
        const h = d.ret&&d.ret[0] ? d.ret[0] : "";
        
        if (h.includes("FAIL_SYS_SESSION_EXPIRED") || h.includes("FAIL_SYS_TOKEN_EMPTY")) {
            return false;
        }
        
        return true;
    } catch(e) {
        return true; 
    }
}

async function getAccountInfo() {
    return new Promise(async (resolve) => {
        try {
            let token;
            try {
                token = await getBrowserToken();
            } catch(e) {
                return resolve({ isConnected: false, username: "לא מחובר", token: "לא מחובר" });
            }

            const isActuallyConnected = await verifyRealConnectionViaAPI(token);

            if (!isActuallyConnected) {
                return resolve({ isConnected: false, username: "לא מחובר", token: "לא מחובר" });
            }

            const cookies = await chrome.cookies.getAll({ domain: "aliexpress.com" });
            let username = "משתמש מחובר";
            let extractedName = null;

            const tryExtract = (cookieName, regex = null) => {
                if (extractedName) return; 
                const c = cookies.find(c => c.name === cookieName);
                if (c && c.value) {
                    try {
                        let val = decodeURIComponent(c.value);
                        if (val.includes('%')) val = decodeURIComponent(val);
                        
                        if (regex) {
                            const m = val.match(regex);
                            if (m && m[1]) val = m[1];
                            else return;
                        }
                        
                        val = val.replace(/^"+|"+$/g, '').trim();

                        if (val.includes('|')) {
                            const parts = val.split('|');
                            if (parts.length >= 3) {
                                val = parts[1] + " " + parts[2];
                            }
                        }

                        if (val && val !== "1" && val !== "null" && val.toLowerCase() !== "undefined") {
                            extractedName = val;
                        }
                    } catch(e) {}
                }
            };

            tryExtract("sn"); 
            tryExtract("_w_tb_nick"); 
            tryExtract("_nk_"); 
            tryExtract("notice_user_nick"); 
            tryExtract("xman_us_f", /x_user=([^&]+)/); 

            if (extractedName) {
                username = extractedName;
            }

            resolve({ isConnected: true, username: username, token: token });
            
        } catch (err) {
            resolve({ isConnected: false, username: "לא מחובר", token: "לא מחובר" });
        }
    });
}

async function fetchCoins(t=0){
    try {
        await fetch("https://www.aliexpress.com/",{credentials:"include",headers:{"user-agent":MOBILE_UA}});
        await fetch("https://m.aliexpress.com/p/coin-index/index.html",{credentials:"include",headers:{"user-agent":MOBILE_UA}});
        await delay(5000);
        
        const r = await getBrowserToken();
        const a = Date.now();
        const u = "24815441";
        const n = "2E2280406IM61M8MG1F2FB";
        const l = {
            ua: `defaultUA2_load_failed with timeout@@https://m.aliexpress.com/p/coin-index/index.html@@${a}`,
            umidToken: `defaultToken2_load_failed with timeout@@https://m.aliexpress.com/p/coin-index/index.html@@${a-7000}`,
            umidTokenType: "TOKEN",
            playCode: "productSignInCoinChannel",
            signTimeMills: a,
            asac: n,
            currency: "USD",
            locale: "IL",
            _lang: "en_IL",
            _currency: "USD"
        };
        const i = JSON.stringify(l);
        const f = CryptoJS.MD5(`${r}&${a}&${u}&${i}`).toString();
        const g = new URL("https://acs.aliexpress.com/h5/mtop.aliexpress.coin.channel.sign.execute/1.0/");
        g.search = new URLSearchParams({
            jsv: "2.6.1", appKey: u, t: a, sign: f, api: "mtop.aliexpress.coin.channel.sign.execute",
            v: "1.0", isHttps: "1", post: "1", type: "originaljson", H5Request: "true",
            isSec: "1", dataType: "jsonp", security: "true", securityParamsPosition: "data", asac: n
        }).toString();
        
        const y = new URLSearchParams({data:i});
        const c = await fetch(g,{
            method: "POST",
            headers: { "accept": "application/json", "content-type": "application/x-www-form-urlencoded", "user-agent": MOBILE_UA, asac: n },
            body: y, referrer: "https://m.aliexpress.com/", mode: "cors", credentials: "include"
        });
        
        if(!c.ok) throw new Error(`שגיאת רשת: ${c.status} ${c.statusText}`);
        const p = await c.text();
        const m = p.match(/.*\((.*)\)/);
        const d = m&&m[1] ? JSON.parse(m[1]) : JSON.parse(p);
        const h = d.ret&&d.ret[0] ? d.ret[0] : "";
        
        if(h.includes("FAIL_SYS_SESSION_EXPIRED")) throw new Error("נא התחברו קודם לחשבונכם");
        if(h.includes("FAIL_SYS_TOKEN_EXOIRED") || h.includes("FAIL_SYS_TOKEN_EMPTY")){
            if(t<2) { await delay(5000); return fetchCoins(t+1); }
            throw new Error("שגיאת טוקן, נכשל לאחר מספר נסיונות.");
        }
        return d;
    } catch(o) {
        return {error: o.message};
    }
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "collectCoins") {
        triggerCoinCollection(true).then(res => sendResponse(res));
        return true; 
    }
    if (request.action === "getAccountInfo") {
        updateIcon("CHECKING");
        getAccountInfo().then(async res => {
            await checkAndUpdateIconStatus(res);
            sendResponse(res);
        });
        return true;
    }
    if (request.action === "checkAndUpdateIcon") {
        checkAndUpdateIconStatus();
        return true;
    }
});

chrome.tabs.onRemoved.addListener((tabId) => {
    chrome.storage.local.get(["matbehAli_activeTabId"], (state) => {
        if (state.matbehAli_activeTabId === tabId) {
            chrome.storage.local.remove([
                'matbehAli_resumeCollect', 
                'matbehAli_userStarted',
                'matbehAli_taskTime', 
                'matbehAli_clickedCount',
                'matbehAli_passCount',
                'matbehAli_activeTabId'
            ]);
        }
    });
});
