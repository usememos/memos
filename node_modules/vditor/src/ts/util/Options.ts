import {Constants} from "../constants";
import {merge} from "./merge";

export class Options {
    public options: IOptions;
    private defaultOptions: IOptions = {
        rtl: false,
        after: undefined,
        cache: {
            enable: true,
        },
        cdn: Constants.CDN,
        classes: {
            preview: "",
        },
        comment: {
            enable: false,
        },
        counter: {
            enable: false,
            type: "markdown",
        },
        debugger: false,
        fullscreen: {
            index: 90,
        },
        height: "auto",
        hint: {
            delay: 200,
            emoji: {
                "+1": "👍",
                "-1": "👎",
                "confused": "😕",
                "eyes": "👀️",
                "heart": "❤️",
                "rocket": "🚀️",
                "smile": "😄",
                "tada": "🎉️",
            },
            emojiPath: `${Constants.CDN}/dist/images/emoji`,
            extend: [],
            parse: true,
        },
        icon: "ant",
        lang: "zh_CN",
        mode: "ir",
        outline: {
            enable: false,
            position: "left",
        },
        placeholder: "",
        preview: {
            actions: ["desktop", "tablet", "mobile", "mp-wechat", "zhihu"],
            delay: 1000,
            hljs: Constants.HLJS_OPTIONS,
            markdown: Constants.MARKDOWN_OPTIONS,
            math: Constants.MATH_OPTIONS,
            maxWidth: 800,
            mode: "both",
            theme: Constants.THEME_OPTIONS,
        },
        link: {
            isOpen: true,
        },
        image: {
            isPreview: true,
        },
        resize: {
            enable: false,
            position: "bottom",
        },
        theme: "classic",
        toolbar: [
            "emoji",
            "headings",
            "bold",
            "italic",
            "strike",
            "link",
            "|",
            "list",
            "ordered-list",
            "check",
            "outdent",
            "indent",
            "|",
            "quote",
            "line",
            "code",
            "inline-code",
            "insert-before",
            "insert-after",
            "|",
            "upload",
            "record",
            "table",
            "|",
            "undo",
            "redo",
            "|",
            "fullscreen",
            "edit-mode",
            {
                name: "more",
                toolbar: [
                    "both",
                    "code-theme",
                    "content-theme",
                    "export",
                    "outline",
                    "preview",
                    "devtools",
                    "info",
                    "help",
                ],
            },
        ],
        toolbarConfig: {
            hide: false,
            pin: false,
        },
        typewriterMode: false,
        undoDelay: 800,
        upload: {
            extraData: {},
            fieldName: "file[]",
            filename: (name: string) => name.replace(/\W/g, ""),
            linkToImgUrl: "",
            max: 10 * 1024 * 1024,
            multiple: true,
            url: "",
            withCredentials: false,
        },
        value: "",
        width: "auto",
    };

    constructor(options: IOptions) {
        this.options = options;
    }

    public merge(): IOptions {
        if (this.options) {
            if (this.options.toolbar) {
                this.options.toolbar = this.mergeToolbar(this.options.toolbar);
            } else {
                this.options.toolbar = this.mergeToolbar(this.defaultOptions.toolbar);
            }
            if (this.options.preview?.theme?.list) {
                this.defaultOptions.preview.theme.list = this.options.preview.theme.list;
            }
            if (this.options.hint?.emoji) {
                this.defaultOptions.hint.emoji = this.options.hint.emoji;
            }
            if (this.options.comment) {
                this.defaultOptions.comment = this.options.comment;
            }
            // 支持不够完善，我先注释了，后期再打开
            // if (this.options.rtl) {
            //     this.defaultOptions.rtl = this.options.rtl;
            // }
        }

        const mergedOptions = merge(this.defaultOptions, this.options);

        if (mergedOptions.cache.enable && !mergedOptions.cache.id) {
            throw new Error(
                "need options.cache.id, see https://ld246.com/article/1549638745630#options",
            );
        }

        return mergedOptions;
    }

    private mergeToolbar(toolbar: Array<string | IMenuItem>) {
        const toolbarItem = [
            {
                icon: '<svg><use xlink:href="#vditor-icon-export"></use></svg>',
                name: "export",
                tipPosition: "ne",
            },
            {
                hotkey: "⌘E",
                icon: '<svg><use xlink:href="#vditor-icon-emoji"></use></svg>',
                name: "emoji",
                tipPosition: "ne",
            },
            {
                hotkey: "⌘H",
                icon:
                    '<svg><use xlink:href="#vditor-icon-headings"></use></svg>',
                name: "headings",
                tipPosition: "ne",
            },
            {
                hotkey: "⌘B",
                icon: '<svg><use xlink:href="#vditor-icon-bold"></use></svg>',
                name: "bold",
                prefix: "**",
                suffix: "**",
                tipPosition: "ne",
            },
            {
                hotkey: "⌘I",
                icon: '<svg><use xlink:href="#vditor-icon-italic"></use></svg>',
                name: "italic",
                prefix: "*",
                suffix: "*",
                tipPosition: "ne",
            },
            {
                hotkey: "⌘D",
                icon: '<svg><use xlink:href="#vditor-icon-strike"></use></svg>',
                name: "strike",
                prefix: "~~",
                suffix: "~~",
                tipPosition: "ne",
            },
            {
                hotkey: "⌘K",
                icon: '<svg><use xlink:href="#vditor-icon-link"></use></svg>',
                name: "link",
                prefix: "[",
                suffix: "](https://)",
                tipPosition: "n",
            },
            {
                name: "|",
            },
            {
                hotkey: "⌘L",
                icon: '<svg><use xlink:href="#vditor-icon-list"></use></svg>',
                name: "list",
                prefix: "* ",
                tipPosition: "n",
            },
            {
                hotkey: "⌘O",
                icon:
                    '<svg><use xlink:href="#vditor-icon-ordered-list"></use></svg>',
                name: "ordered-list",
                prefix: "1. ",
                tipPosition: "n",
            },
            {
                hotkey: "⌘J",
                icon: '<svg><use xlink:href="#vditor-icon-check"></use></svg>',
                name: "check",
                prefix: "* [ ] ",
                tipPosition: "n",
            },
            {
                hotkey: "⇧⌘I",
                icon:
                    '<svg><use xlink:href="#vditor-icon-outdent"></use></svg>',
                name: "outdent",
                tipPosition: "n",
            },
            {
                hotkey: "⇧⌘O",
                icon: '<svg><use xlink:href="#vditor-icon-indent"></use></svg>',
                name: "indent",
                tipPosition: "n",
            },
            {
                name: "|",
            },
            {
                hotkey: "⌘;",
                icon: '<svg><use xlink:href="#vditor-icon-quote"></use></svg>',
                name: "quote",
                prefix: "> ",
                tipPosition: "n",
            },
            {
                hotkey: "⇧⌘H",
                icon: '<svg><use xlink:href="#vditor-icon-line"></use></svg>',
                name: "line",
                prefix: "---",
                tipPosition: "n",
            },
            {
                hotkey: "⌘U",
                icon: '<svg><use xlink:href="#vditor-icon-code"></use></svg>',
                name: "code",
                prefix: "```",
                suffix: "\n```",
                tipPosition: "n",
            },
            {
                hotkey: "⌘G",
                icon:
                    '<svg><use xlink:href="#vditor-icon-inline-code"></use></svg>',
                name: "inline-code",
                prefix: "`",
                suffix: "`",
                tipPosition: "n",
            },
            {
                hotkey: "⇧⌘B",
                icon: '<svg><use xlink:href="#vditor-icon-before"></use></svg>',
                name: "insert-before",
                tipPosition: "n",
            },
            {
                hotkey: "⇧⌘E",
                icon: '<svg><use xlink:href="#vditor-icon-after"></use></svg>',
                name: "insert-after",
                tipPosition: "n",
            },
            {
                name: "|",
            },
            {
                icon: '<svg><use xlink:href="#vditor-icon-upload"></use></svg>',
                name: "upload",
                tipPosition: "n",
            },
            {
                icon: '<svg><use xlink:href="#vditor-icon-record"></use></svg>',
                name: "record",
                tipPosition: "n",
            },
            {
                hotkey: "⌘M",
                icon: '<svg><use xlink:href="#vditor-icon-table"></use></svg>',
                name: "table",
                prefix: "| col1",
                suffix:
                    " | col2 | col3 |\n| --- | --- | --- |\n|  |  |  |\n|  |  |  |",
                tipPosition: "n",
            },
            {
                name: "|",
            },
            {
                hotkey: "⌘Z",
                icon: '<svg><use xlink:href="#vditor-icon-undo"></use></svg>',
                name: "undo",
                tipPosition: "nw",
            },
            {
                hotkey: "⌘Y",
                icon: '<svg><use xlink:href="#vditor-icon-redo"></use></svg>',
                name: "redo",
                tipPosition: "nw",
            },
            {
                name: "|",
            },
            {
                icon: '<svg><use xlink:href="#vditor-icon-more"></use></svg>',
                name: "more",
                tipPosition: "e",
            },
            {
                hotkey: "⌘'",
                icon:
                    '<svg><use xlink:href="#vditor-icon-fullscreen"></use></svg>',
                name: "fullscreen",
                tipPosition: "nw",
            },
            {
                icon: '<svg><use xlink:href="#vditor-icon-edit"></use></svg>',
                name: "edit-mode",
                tipPosition: "nw",
            },
            {
                hotkey: "⌘P",
                icon: '<svg><use xlink:href="#vditor-icon-both"></use></svg>',
                name: "both",
                tipPosition: "nw",
            },
            {
                icon:
                    '<svg><use xlink:href="#vditor-icon-preview"></use></svg>',
                name: "preview",
                tipPosition: "nw",
            },
            {
                icon:
                    '<svg><use xlink:href="#vditor-icon-align-center"></use></svg>',
                name: "outline",
                tipPosition: "nw",
            },
            {
                icon: '<svg><use xlink:href="#vditor-icon-theme"></use></svg>',
                name: "content-theme",
                tipPosition: "nw",
            },
            {
                icon:
                    '<svg><use xlink:href="#vditor-icon-code-theme"></use></svg>',
                name: "code-theme",
                tipPosition: "nw",
            },
            {
                icon: '<svg><use xlink:href="#vditor-icon-bug"></use></svg>',
                name: "devtools",
                tipPosition: "nw",
            },
            {
                icon: '<svg><use xlink:href="#vditor-icon-info"></use></svg>',
                name: "info",
                tipPosition: "nw",
            },
            {
                icon: '<svg><use xlink:href="#vditor-icon-help"></use></svg>',
                name: "help",
                tipPosition: "nw",
            },
            {
                name: "br",
            },
        ];
        const toolbarResult: IMenuItem[] = [];
        toolbar.forEach((menuItem: IMenuItem) => {
            let currentMenuItem = menuItem;
            toolbarItem.forEach((defaultMenuItem: IMenuItem) => {
                if (
                    typeof menuItem === "string" &&
                    defaultMenuItem.name === menuItem
                ) {
                    currentMenuItem = defaultMenuItem;
                }
                if (
                    typeof menuItem === "object" &&
                    defaultMenuItem.name === menuItem.name
                ) {
                    currentMenuItem = Object.assign({}, defaultMenuItem, menuItem);
                }
            });
            if (menuItem.toolbar) {
                currentMenuItem.toolbar = this.mergeToolbar(menuItem.toolbar);
            }
            toolbarResult.push(currentMenuItem);
        });
        return toolbarResult;
    }
}
