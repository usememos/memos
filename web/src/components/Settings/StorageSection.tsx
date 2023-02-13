import { Radio } from "@mui/joy";
import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useGlobalStore, useStorageStore } from "../../store/module";
import * as api from "../../helpers/api";
import showCreateStorageServiceDialog from "../CreateStorageServiceDialog";
import showUpdateStorageServiceDialog from "../UpdateStorageServiceDialog";
import "../../less/settings/storage-section.less";

const StorageSection = () => {
  const { t } = useTranslation();
  const storageStore = useStorageStore();
  const storages = storageStore.state.storages;
  const globalStore = useGlobalStore();
  const systemStatus = globalStore.state.systemStatus;
  const [storageServiceId, setStorageServiceId] = useState(systemStatus.storageServiceId);

  useEffect(() => {
    storageStore.fetchStorages();
    globalStore.fetchSystemStatus();
  }, []);

  useEffect(() => {
    setStorageServiceId(systemStatus.storageServiceId);
  }, [systemStatus]);

  const handleActiveStorageServiceChanged = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(event.target.value);
    setStorageServiceId(value);
    await api.upsertSystemSetting({
      name: "storageServiceId",
      value: JSON.stringify(value),
    });
  };

  const handleStorageServiceUpdate = async (event: React.MouseEvent, storage: Storage) => {
    event.preventDefault();
    showUpdateStorageServiceDialog(storage);
  };

  return (
    <div className="section-container storage-section-container">
      <p className="title-text">{t("setting.storage-section.storage-services-list")}</p>
      {storages.map((storage) => (
        <label className="form-label selector" key={storage.id}>
          <span className="normal-text underline cursor-pointer" onClick={(event) => handleStorageServiceUpdate(event, storage)}>
            {storage.name}
          </span>
          <Radio value={storage.id} checked={storageServiceId === storage.id} onChange={handleActiveStorageServiceChanged} />
        </label>
      ))}
      <label className="form-label selector">
        <span className="normal-text">{t("common.database")}</span>
        <Radio value={0} checked={storageServiceId === 0} onChange={handleActiveStorageServiceChanged} />
      </label>
      <div className="w-full flex flex-row justify-end items-center mt-2 space-x-2">
        <button className="btn-normal" onClick={showCreateStorageServiceDialog}>
          {t("setting.storage-section.create-a-service")}
        </button>
      </div>
    </div>
  );
};

export default StorageSection;
