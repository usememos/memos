export const isSafari = () => {
    return navigator.userAgent.indexOf("Safari") > -1 && navigator.userAgent.indexOf("Chrome") === -1;
};

export const isFirefox = () => {
    return navigator.userAgent.toLowerCase().indexOf("firefox") > -1;
};

export const accessLocalStorage = () => {
    try {
       return typeof localStorage !== "undefined";
    } catch (e) {
        return false;
    }
};

// 用户 iPhone 点击延迟/需要双击的处理
export const getEventName = () => {
    if (navigator.userAgent.indexOf("iPhone") > -1) {
        return "touchstart";
    } else {
        return "click";
    }
};

// 区别 mac 上的 ctrl 和 meta
export const isCtrl = (event: KeyboardEvent) => {
    if (navigator.platform.toUpperCase().indexOf("MAC") >= 0) {
        // mac
        if (event.metaKey && !event.ctrlKey) {
            return true;
        }
        return false;
    } else {
        if (!event.metaKey && event.ctrlKey) {
            return true;
        }
        return false;
    }
};
// Mac，Windows 快捷键展示
export const updateHotkeyTip = (hotkey: string) => {
    if (/Mac/.test(navigator.platform) || navigator.platform === "iPhone") {
        if (hotkey.indexOf("⇧") > -1 && isFirefox()) {
            // Mac Firefox 按下 shift 后，key 同 windows 系统
            hotkey = hotkey.replace(";", ":").replace("=", "+").replace("-", "_");
        }
    } else {
        if (hotkey.startsWith("⌘")) {
            hotkey = hotkey.replace("⌘", "⌘+");
        } else if (hotkey.startsWith("⌥") && hotkey.substr(1, 1) !== "⌘") {
            hotkey = hotkey.replace("⌥", "⌥+");
        } else {
            hotkey = hotkey.replace("⇧⌘", "⌘+⇧+").replace("⌥⌘", "⌥+⌘+");
        }
        hotkey = hotkey.replace("⌘", "Ctrl").replace("⇧", "Shift")
            .replace("⌥", "Alt");
        if (hotkey.indexOf("Shift") > -1) {
            hotkey = hotkey.replace(";", ":").replace("=", "+").replace("-", "_");
        }
    }
    return hotkey;
};

export const isChrome = () => {
    return /Chrome/.test(navigator.userAgent) && /Google Inc/.test(navigator.vendor);
};
