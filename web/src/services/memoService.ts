import api from "../helpers/api";
import { TAG_REG } from "../helpers/consts";
import appStore from "../stores/appStore";
import userService from "./userService";

class MemoService {
  public initialized = false;

  public getState() {
    return appStore.getState().memoState;
  }

  public async fetchAllMemos() {
    if (!userService.getState().user) {
      return false;
    }

    const { data } = await api.getMyMemos();
    const memos = [];
    for (const m of data) {
      memos.push(m);
    }
    appStore.dispatch({
      type: "SET_MEMOS",
      payload: {
        memos,
      },
    });

    if (!this.initialized) {
      this.initialized = true;
    }

    return memos;
  }

  public async fetchDeletedMemos() {
    if (!userService.getState().user) {
      return false;
    }

    const { data } = await api.getMyDeletedMemos();
    return data;
  }

  public pushMemo(memo: Model.Memo) {
    appStore.dispatch({
      type: "INSERT_MEMO",
      payload: {
        memo: {
          ...memo,
        },
      },
    });
  }

  public getMemoById(id: string) {
    for (const m of this.getState().memos) {
      if (m.id === id) {
        return m;
      }
    }

    return null;
  }

  public async hideMemoById(id: string) {
    await api.hideMemo(id);
    appStore.dispatch({
      type: "DELETE_MEMO_BY_ID",
      payload: {
        id: id,
      },
    });
  }

  public async restoreMemoById(id: string) {
    await api.restoreMemo(id);
    memoService.clearMemos();
    memoService.fetchAllMemos();
  }

  public async deleteMemoById(id: string) {
    await api.deleteMemo(id);
  }

  public editMemo(memo: Model.Memo) {
    appStore.dispatch({
      type: "EDIT_MEMO",
      payload: memo,
    });
  }

  public updateTagsState() {
    const { memos } = this.getState();
    const tagsSet = new Set<string>();
    for (const m of memos) {
      for (const t of Array.from(m.content.match(TAG_REG) ?? [])) {
        tagsSet.add(t.replace(TAG_REG, "$1").trim());
      }
    }

    appStore.dispatch({
      type: "SET_TAGS",
      payload: {
        tags: Array.from(tagsSet),
      },
    });
  }

  public clearMemos() {
    appStore.dispatch({
      type: "SET_MEMOS",
      payload: {
        memos: [],
      },
    });
  }

  public async getLinkedMemos(memoId: string): Promise<Model.Memo[]> {
    const { memos } = this.getState();
    return memos.filter((m) => m.content.includes(memoId));
  }

  public async createMemo(text: string): Promise<Model.Memo> {
    const { data: memo } = await api.createMemo(text);
    return memo;
  }

  public async updateMemo(memoId: string, text: string): Promise<Model.Memo> {
    const { data: memo } = await api.updateMemo(memoId, text);
    return memo;
  }
}

const memoService = new MemoService();

export default memoService;
