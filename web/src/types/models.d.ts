declare namespace Model {
  interface BaseModel {
    id: string;
    createdTs: number;
    updatedTs: number;

    createdAt: string;
    updatedAt: string;
  }

  interface User extends BaseModel {
    name: string;
    openId: string;
  }

  interface Memo extends BaseModel {
    content: string;
    rowStatus: "NORMAL" | "HIDDEN";
  }

  interface Shortcut extends BaseModel {
    title: string;
    payload: string;
    rowStatus: "NORMAL" | "ARCHIVED";
  }

  interface Resource extends BaseModel {
    filename: string;
    type: string;
    size: string;
    createdAt: string;
  }
}
