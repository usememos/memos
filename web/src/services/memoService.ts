import api from "../helpers/api";
import { TAG_REG } from "../helpers/consts";
import utils from "../helpers/utils";
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

    const data = await api.getMyMemos();
    const memos: Memo[] = data.filter((m) => m.rowStatus !== "ARCHIVED").map((m) => this.convertResponseModelMemo(m));
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

    const data = await api.getMyArchivedMemos();
    const deletedMemos: Memo[] = data.map((m) => {
      return this.convertResponseModelMemo(m);
    });
    return deletedMemos;
  }

  public pushMemo(memo: Memo) {
    appStore.dispatch({
      type: "INSERT_MEMO",
      payload: {
        memo: {
          ...memo,
        },
      },
    });
  }

  public getMemoById(id: MemoId) {
    for (const m of this.getState().memos) {
      if (m.id === id) {
        return m;
      }
    }

    return null;
  }

  public async hideMemoById(id: MemoId) {
    await api.archiveMemo(id);
    appStore.dispatch({
      type: "DELETE_MEMO_BY_ID",
      payload: {
        id: id,
      },
    });
  }

  public async restoreMemoById(id: MemoId) {
    await api.restoreMemo(id);
    memoService.clearMemos();
    memoService.fetchAllMemos();
  }

  public async deleteMemoById(id: MemoId) {
    await api.deleteMemo(id);
  }

  public editMemo(memo: Memo) {
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
        tags: Array.from(tagsSet).filter((t) => Boolean(t)),
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

  public async getLinkedMemos(memoId: MemoId): Promise<Memo[]> {
    const { memos } = this.getState();
    return memos.filter((m) => m.content.includes(`${memoId}`));
  }

  public async createMemo(content: string): Promise<Memo> {
    const memo = await api.createMemo({
      content,
    });
    return this.convertResponseModelMemo(memo);
  }

  public async updateMemo(memoId: MemoId, content: string): Promise<Memo> {
    const memo = await api.patchMemo({
      id: memoId,
      content,
    });
    return this.convertResponseModelMemo(memo);
  }

  public async pinMemo(memoId: MemoId) {
    await api.pinMemo(memoId);
  }

  public async unpinMemo(memoId: MemoId) {
    await api.unpinMemo(memoId);
  }

  public async importMemo(content: string, createdAt: string) {
    const createdTs = Math.floor(utils.getTimeStampByDate(createdAt) / 1000);

    await api.createMemo({
      content,
      createdTs,
    });
  }

  private convertResponseModelMemo(memo: Memo): Memo {
    return {
      ...memo,
      createdTs: memo.createdTs * 1000,
      updatedTs: memo.updatedTs * 1000,
    };
  }
}

const memoService = new MemoService();

export default memoService;
