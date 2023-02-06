export const code160to32 = (text: string) => {
    // 非打断空格转换为空格
    return text.replace(/\u00a0/g, " ");
};
