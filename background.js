importScripts("crypto-js.min.js");

let isCollecting = false;
const ALARM_NAME = "hourlyCoinCollection";
const EIGHT_HOURS_MS = 8 * 60 * 60 * 1000;

function updateIcon(statusType) {
    let prefix = "ICON";
    if (statusType === "DISCONNECTED" || statusType === "FAILED") {
        prefix = "DICON";
    } else if (statusType === "UPDATE_AVAILABLE") {
        prefix = "NICON";
    } else if (statusType === "SUCCESS") {
        prefix = "ICON";
    }

    chrome.action.setIcon({
        path: {
            "16": `images/${prefix}16.png`,
            "48": `images/${prefix}48.png`,
            "128": `images/${prefix}128.png`
        }
    });
}

async function triggerCoinCollection(manual = false) {
    if (isCollecting) return { status: "RUNNING", message: "רץ-כעת..." };
    isCollecting = true;

    try {
        const storage = await chrome.storage.local.get(["lastSuccessMs", "hasGitHubUpdate"]);
        const now = Date.now();

        if (!manual && storage.lastSuccessMs && (now - storage.lastSuccessMs < EIGHT_HOURS_MS)) {
            isCollecting = false;
            return { status: "WAITING", message: "בהמתנה של 8 שעות" };
        }

        const result = await fetchCoins();
        const timeString = new Date().toLocaleString('he-IL');
        const updates = { lastRunTime: timeString };

        if (result.error) {
            let reason = "שגיאה כללית";
            if (result.error.includes("נא התחברו") || result.error.includes("EXPIRED") || result.error.includes("עוגיית אימות")) {
                reason = "לא מחובר לחשבון";
                updateIcon("DISCONNECTED");
            } else if (result.error.includes("שגיאת רשת") || result.error.includes("timeout")) {
                reason = "אין אינטרנט";
                updateIcon("FAILED");
            } else {
                reason = result.error;
                updateIcon("FAILED");
            }
            
            updates.lastRunStatus = "נכשל: " + reason;
            updates.lastFailTime = timeString;
            updates.lastFailReason = reason;
            await chrome.storage.local.set(updates);
            
            return { status: "FAILED", message: updates.lastRunStatus };
        }

        const data = result?.data?.data;

        if (storage.hasGitHubUpdate) {
            updateIcon("UPDATE_AVAILABLE");
        } else {
            updateIcon("SUCCESS");
        }

        updates.lastSuccessMs = Date.now(); 

        if (data?.signSuccess) {
            updates.lastRunStatus = "אסף בהצלחה";
            updates.lastCollectedTime = timeString;
            await chrome.storage.local.set(updates);
            return { status: "COLLECTED", message: "אסף בהצלחה" };
            
        } else if (data?.todayAlreadySign) {
            updates.lastRunStatus = "אין איסוף זמין";
            updates.lastNoCollectTime = timeString;
            await chrome.storage.local.set(updates);
            return { status: "NO_COLLECT", message: "אין איסוף זמין" };
            
        } else {
            const errorMsg = result?.ret?.[0] || "שגיאה לא ידועה מהשרת.";
            updates.lastRunStatus = "נכשל: " + errorMsg;
            updates.lastFailTime = timeString;
            updates.lastFailReason = errorMsg;
            delete updates.lastSuccessMs; 
            
            await chrome.storage.local.set(updates);
            return { status: "FAILED", message: updates.lastRunStatus };
        }
    } catch (e) {
        await chrome.storage.local.set({ 
            lastRunTime: new Date().toLocaleString('he-IL'),
            lastRunStatus: "נכשל: " + e.message,
            lastFailTime: new Date().toLocaleString('he-IL'), 
            lastFailReason: e.message 
        });
        updateIcon("FAILED");
        return { status: "FAILED", message: "נכשל: " + e.message };
    } finally {
        isCollecting = false;
    }
}

chrome.runtime.onInstalled.addListener(() => {
    chrome.alarms.create(ALARM_NAME, { periodInMinutes: 60 });
    triggerCoinCollection();
});

chrome.runtime.onStartup.addListener(() => {
    triggerCoinCollection();
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

// הפונקציה החדשה על בסיס הרעיון שלך! בודקת חיבור אקטיבי מול ה-API של המטבעות
async function verifyRealConnectionViaAPI(token) {
    try {
        const a = Date.now();
        const u = "24815441";
        // שימוש בפלייקוד של המטבעות כדי לאלץ את השרת לבדוק אם אנחנו מחוברים
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
        
        // הוכחה חותכת שאין חיבור
        if (h.includes("FAIL_SYS_SESSION_EXPIRED") || h.includes("FAIL_SYS_TOKEN_EMPTY")) {
            return false;
        }
        
        // כל תשובה אחרת (כולל הצלחה או שכבר נאסף) אומרת שאנחנו מחוברים!
        return true;
    } catch(e) {
        // במקרה של שגיאת תקשורת נניח שמחוברים כדי לא לנתק סתם
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
                // אם אי אפשר להשיג טוקן בשום צורה, ודאי לא מחוברים
                return resolve({ isConnected: false, username: "לא מחובר", token: "לא מחובר" });
            }

            // בדיקה האם מחוברים באמת דרך API המטבעות!
            const isActuallyConnected = await verifyRealConnectionViaAPI(token);

            if (!isActuallyConnected) {
                return resolve({ isConnected: false, username: "לא מחובר", token: "לא מחובר" });
            }

            // חילוץ שם משתמש רק במידה ו-וודאנו חיבור
            const cookies = await chrome.cookies.getAll({ domain: "aliexpress.com" });
            let username = "משתמש מחובר";
            const nkCookie = cookies.find(c => c.name === "_nk_" || c.name === "notice_user_nick");
            if (nkCookie) {
                try {
                    const decoded = decodeURIComponent(decodeURIComponent(nkCookie.value)).replace(/^"+|"+$/g, '').trim();
                    if (decoded.length > 1 && decoded !== "1" && decoded !== "null") {
                        username = decoded;
                    }
                } catch (e) {}
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
        getAccountInfo().then(res => sendResponse(res));
        return true;
    }
});