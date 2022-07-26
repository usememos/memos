import React, { useEffect, useState } from "react";
import { isEmpty } from "lodash-es";
import { userService } from "../../services";
import { useAppSelector } from "../../store";
import * as api from "../../helpers/api";
import toastHelper from "../Toast";
import "../../less/settings/member-section.less";

interface Props {}

interface State {
  createUserEmail: string;
  createUserPassword: string;
}

const PreferencesSection: React.FC<Props> = () => {
  const currentUser = useAppSelector((state) => state.user.user);
  const [state, setState] = useState<State>({
    createUserEmail: "",
    createUserPassword: "",
  });
  const [userList, setUserList] = useState<User[]>([]);

  useEffect(() => {
    fetchUserList();
  }, []);

  const fetchUserList = async () => {
    const { data } = (await api.getUserList()).data;
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

    const userCreate: UserCreate = {
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

  const handleArchiveUserClick = async (user: User) => {
    await userService.patchUser({
      id: user.id,
      rowStatus: "ARCHIVED",
    });
    fetchUserList();
  };

  const handleRestoreUserClick = async (user: User) => {
    await userService.patchUser({
      id: user.id,
      rowStatus: "NORMAL",
    });
    fetchUserList();
  };

  // TODO: show a dialog to confirm delete user.
  const handleDeleteUserClick = async (user: User) => {
    await userService.deleteUser({
      id: user.id,
    });
    fetchUserList();
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
      <div className="member-container field-container">
        <span className="field-text">ID</span>
        <span className="field-text">EMAIL</span>
        <span></span>
      </div>
      {userList.map((user) => (
        <div key={user.id} className={`member-container ${user.rowStatus === "ARCHIVED" ? "archived" : ""}`}>
          <span className="field-text id-text">{user.id}</span>
          <span className="field-text email-text">{user.email}</span>
          <div className="buttons-container">
            {currentUser?.id === user.id ? (
              <span className="tip-text">Yourself</span>
            ) : user.rowStatus === "NORMAL" ? (
              <span className="btn archive" onClick={() => handleArchiveUserClick(user)}>
                archive
              </span>
            ) : (
              <>
                <span className="btn restore" onClick={() => handleRestoreUserClick(user)}>
                  restore
                </span>
                <span className="split-line">/</span>
                <span className="btn delete" onClick={() => handleDeleteUserClick(user)}>
                  delete
                </span>
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

export default PreferencesSection;
