import utils from "../helpers/utils";

export interface State {
  queries: Model.Query[];
}

interface SetQueries {
  type: "SET_QUERIES";
  payload: {
    queries: Model.Query[];
  };
}

interface InsertQueryAction {
  type: "INSERT_QUERY";
  payload: {
    query: Model.Query;
  };
}

interface DeleteQueryByIdAction {
  type: "DELETE_QUERY_BY_ID";
  payload: {
    id: string;
  };
}

interface UpdateQueryAction {
  type: "UPDATE_QUERY";
  payload: Model.Query;
}

export type Actions = SetQueries | InsertQueryAction | DeleteQueryByIdAction | UpdateQueryAction;

export function reducer(state: State, action: Actions): State {
  switch (action.type) {
    case "SET_QUERIES": {
      const queries = utils.dedupeObjectWithId(
        action.payload.queries
          .sort((a, b) => utils.getTimeStampByDate(b.createdAt) - utils.getTimeStampByDate(a.createdAt))
          .sort((a, b) => utils.getTimeStampByDate(b.pinnedAt ?? 0) - utils.getTimeStampByDate(a.pinnedAt ?? 0))
      );

      return {
        ...state,
        queries,
      };
    }
    case "INSERT_QUERY": {
      const queries = utils.dedupeObjectWithId(
        [action.payload.query, ...state.queries].sort(
          (a, b) => utils.getTimeStampByDate(b.createdAt) - utils.getTimeStampByDate(a.createdAt)
        )
      );

      return {
        ...state,
        queries,
      };
    }
    case "DELETE_QUERY_BY_ID": {
      return {
        ...state,
        queries: [...state.queries].filter((query) => query.id !== action.payload.id),
      };
    }
    case "UPDATE_QUERY": {
      const queries = state.queries.map((m) => {
        if (m.id === action.payload.id) {
          return {
            ...m,
            ...action.payload,
          };
        } else {
          return m;
        }
      });

      return {
        ...state,
        queries,
      };
    }
    default: {
      return state;
    }
  }
}

export const defaultState: State = {
  queries: [],
};
