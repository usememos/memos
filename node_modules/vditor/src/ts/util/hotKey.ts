import {isCtrl, isFirefox} from "./compatibility";

// 是否匹配 ⇧⌘[] / ⌘[] / ⌥[] / ⌥⌘[] / ⇧Tab / []
export const matchHotKey = (hotKey: string, event: KeyboardEvent) => {
    if (hotKey === "") {
        return false;
    }

    // []
    if (hotKey.indexOf("⇧") === -1 && hotKey.indexOf("⌘") === -1 && hotKey.indexOf("⌥") === -1) {
        if (!isCtrl(event) && !event.altKey && !event.shiftKey && event.code === hotKey) {
            return true;
        }
        return false;
    }

    // 是否匹配 ⇧Tab
    if (hotKey === "⇧Tab") {
        if (!isCtrl(event) && !event.altKey && event.shiftKey && event.code === "Tab") {
            return true;
        }
        return false;
    }

    let hotKeys = hotKey.split("");
    if (hotKey.startsWith("⌥")) {
        // 是否匹配 ⌥[] / ⌥⌘[]
        const keyCode = hotKeys.length === 3 ? hotKeys[2] : hotKeys[1];
        if ((hotKeys.length === 3 ? isCtrl(event) : !isCtrl(event)) && event.altKey && !event.shiftKey &&
            event.code === (/^[0-9]$/.test(keyCode) ? "Digit" : "Key") + keyCode) {
            return true;
        }
        return false;
    }

    // 是否匹配 ⇧⌘[] / ⌘[]
    if (hotKey === "⌘Enter") {
        hotKeys = ["⌘", "Enter"];
    }
    const hasShift = hotKeys.length > 2 && (hotKeys[0] === "⇧");
    let key = (hasShift ? hotKeys[2] : hotKeys[1]);
    if (hasShift && (isFirefox() || !/Mac/.test(navigator.platform))) {
        if (key === "-") {
            key = "_";
        } else if (key === "=") {
            key = "+";
        }
    }
    if (isCtrl(event) && event.key.toLowerCase() === key.toLowerCase() && !event.altKey
        && ((!hasShift && !event.shiftKey) || (hasShift && event.shiftKey))) {
        return true;
    }
    return false;
};
