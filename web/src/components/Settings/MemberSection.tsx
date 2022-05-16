import React, { useEffect, useState } from "react";
import { isEmpty } from "lodash-es";
import api from "../../helpers/api";
import toastHelper from "../Toast";
import "../../less/settings/member-section.less";

interface Props {}

interface State {
  createUserEmail: string;
  createUserPassword: string;
}

const PreferencesSection: React.FC<Props> = () => {
  const [state, setState] = useState<State>({
    createUserEmail: "",
    createUserPassword: "",
  });
  const [userList, setUserList] = useState<Model.User[]>([]);

  useEffect(() => {
    fetchUserList();
  }, []);

  const fetchUserList = async () => {
    const data = await api.getUserList();
    setUserList(data);
  };

  const handleEmailInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setState({
      ...state,
      createUserEmail: event.target.value,
    });
  };

  const handlePasswordInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setState({
      ...state,
      createUserPassword: event.target.value,
    });
  };

  const handleCreateUserBtnClick = async () => {
    if (isEmpty(state.createUserEmail) || isEmpty(state.createUserPassword)) {
      toastHelper.error("Please fill out this form");
      return;
    }

    const userCreate: API.UserCreate = {
      email: state.createUserEmail,
      password: state.createUserPassword,
      role: "USER",
      name: state.createUserEmail,
    };

    try {
      await api.createUser(userCreate);
    } catch (error: any) {
      toastHelper.error(error.message);
    }
    await fetchUserList();
    setState({
      createUserEmail: "",
      createUserPassword: "",
    });
  };

  return (
    <div className="section-container member-section-container">
      <p className="title-text">Create a member</p>
      <div className="create-member-container">
        <div className="input-form-container">
          <span className="field-text">Email</span>
          <input type="email" placeholder="Email" value={state.createUserEmail} onChange={handleEmailInputChange} />
        </div>
        <div className="input-form-container">
          <span className="field-text">Password</span>
          <input type="text" placeholder="Password" value={state.createUserPassword} onChange={handlePasswordInputChange} />
        </div>
        <div className="btns-container">
          <button onClick={handleCreateUserBtnClick}>Create</button>
        </div>
      </div>
      <p className="title-text">Member list</p>
      {userList.map((user) => (
        <div key={user.id} className="user-container">
          <span className="field-text id-text">{user.id}</span>
          <span className="field-text">{user.email}</span>
        </div>
      ))}
    </div>
  );
};

export default PreferencesSection;
