type UserRole = "OWNER" | "USER";

declare namespace Model {
  interface BaseModel {
    id: string;
    createdTs: number;
    updatedTs: number;

    createdAt: string;
    updatedAt: string;
  }

  interface User extends BaseModel {
    role: UserRole;
    email: string;
    name: string;
    openId: string;
  }

  interface Memo extends BaseModel {
    content: string;
    rowStatus: "NORMAL" | "ARCHIVED" | "HIDDEN";
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
