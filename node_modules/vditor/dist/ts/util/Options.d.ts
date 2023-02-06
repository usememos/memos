/// <reference types="./types" />
export declare class Options {
    options: IOptions;
    private defaultOptions;
    constructor(options: IOptions);
    merge(): IOptions;
    private mergeToolbar;
}
