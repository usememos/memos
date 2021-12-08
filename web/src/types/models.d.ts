declare namespace Model {
  interface BaseModel {
    id: string;
    createdAt: string;
    updatedAt: string;
  }

  interface User extends BaseModel {
    username: string;
    githubName?: string;
    wxUserId?: string;
  }

  interface Memo extends BaseModel {
    content: string;
    deletedAt?: string;
  }

  interface Query extends BaseModel {
    title: string;
    querystring: string;
    pinnedAt?: string;
  }
}
