import userService from "./userService";
import api from "../helpers/api";
import appStore from "../stores/appStore";

class QueryService {
  public getState() {
    return appStore.getState().queryState;
  }

  public async getMyAllQueries() {
    if (!userService.getState().user) {
      return false;
    }

    const { data } = await api.getMyQueries();
    appStore.dispatch({
      type: "SET_QUERIES",
      payload: {
        queries: data,
      },
    });
    return data;
  }

  public getQueryById(id: string) {
    for (const q of this.getState().queries) {
      if (q.id === id) {
        return q;
      }
    }
  }

  public pushQuery(query: Model.Query) {
    appStore.dispatch({
      type: "INSERT_QUERY",
      payload: {
        query: {
          ...query,
        },
      },
    });
  }

  public editQuery(query: Model.Query) {
    appStore.dispatch({
      type: "UPDATE_QUERY",
      payload: query,
    });
  }

  public async deleteQuery(queryId: string) {
    await api.deleteQueryById(queryId);
    appStore.dispatch({
      type: "DELETE_QUERY_BY_ID",
      payload: {
        id: queryId,
      },
    });
  }

  public async createQuery(title: string, querystring: string) {
    const { data } = await api.createQuery(title, querystring);
    return data;
  }

  public async updateQuery(queryId: string, title: string, querystring: string) {
    const { data } = await api.updateQuery(queryId, title, querystring);
    return data;
  }

  public async pinQuery(queryId: string) {
    await api.pinQuery(queryId);
  }

  public async unpinQuery(queryId: string) {
    await api.unpinQuery(queryId);
  }
}

const queryService = new QueryService();

export default queryService;
