export const log = (method: string, content: string, type: string, print: boolean) => {
    if (print) {
        // @ts-ignore
        console.log(`${method} - ${type}: ${content}`);
    }
};
