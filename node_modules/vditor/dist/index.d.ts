/// <reference types="./types" />
import "./assets/less/index.less";
import VditorMethod from "./method";
declare class Vditor extends VditorMethod {
    readonly version: string;
    vditor: IVditor;
    /**
     * @param id 要挂载 Vditor 的元素或者元素 ID。
     * @param options Vditor 参数
     */
    constructor(id: string | HTMLElement, options?: IOptions);
    /** 设置主题 */
    setTheme(theme: "dark" | "classic", contentTheme?: string, codeTheme?: string, contentThemePath?: string): void;
    /** 获取 Markdown 内容 */
    getValue(): string;
    /** 获取编辑器当前编辑模式 */
    getCurrentMode(): "sv" | "wysiwyg" | "ir";
    /** 聚焦到编辑器 */
    focus(): void;
    /** 让编辑器失焦 */
    blur(): void;
    /** 禁用编辑器 */
    disabled(): void;
    /** 解除编辑器禁用 */
    enable(): void;
    /** 返回选中的字符串 */
    getSelection(): string;
    /** 设置预览区域内容 */
    renderPreview(value?: string): void;
    /** 获取焦点位置 */
    getCursorPosition(): {
        left: number;
        top: number;
    };
    /** 上传是否还在进行中 */
    isUploading(): boolean;
    /** 清除缓存 */
    clearCache(): void;
    /** 禁用缓存 */
    disabledCache(): void;
    /** 启用缓存 */
    enableCache(): void;
    /** HTML 转 md */
    html2md(value: string): string;
    /** markdown 转 JSON 输出 */
    exportJSON(value: string): string;
    /** 获取 HTML */
    getHTML(): string;
    /** 消息提示。time 为 0 将一直显示 */
    tip(text: string, time?: number): void;
    /** 设置预览模式 */
    setPreviewMode(mode: "both" | "editor"): void;
    /** 删除选中内容 */
    deleteValue(): void;
    /** 更新选中内容 */
    updateValue(value: string): void;
    /** 在焦点处插入内容，并默认进行 Markdown 渲染 */
    insertValue(value: string, render?: boolean): void;
    /** 设置编辑器内容 */
    setValue(markdown: string, clearStack?: boolean): void;
    /** 清空 undo & redo 栈 */
    clearStack(): void;
    /** 销毁编辑器 */
    destroy(): void;
    /** 获取评论 ID */
    getCommentIds(): ICommentsData[];
    /** 高亮评论 */
    hlCommentIds(ids: string[]): void;
    /** 取消评论高亮 */
    unHlCommentIds(ids: string[]): void;
    /** 删除评论 */
    removeCommentIds(removeIds: string[]): void;
    private init;
}
export default Vditor;
