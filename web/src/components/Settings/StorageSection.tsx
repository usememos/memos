import { Radio } from "@mui/joy";
import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useGlobalStore, useStorageStore } from "../../store/module";
import * as api from "../../helpers/api";
import showCreateStorageServiceDialog from "../CreateStorageServiceDialog";

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
    showCreateStorageServiceDialog(storage);
  };

  return (
    <div className="section-container">
      <div className="mt-4 mb-2 w-full flex flex-row justify-start items-center">
        <span className="font-mono text-sm text-gray-400 mr-2">{t("setting.storage-section.storage-services-list")}</span>
        <button className="btn-normal px-2 py-0 leading-7" onClick={() => showCreateStorageServiceDialog()}>
          {t("common.create")}
        </button>
      </div>
      {storages.map((storage) => (
        <label className="w-full my-2 flex flex-row justify-between items-center" key={storage.id}>
          <span className="mr-2 text-sm underline cursor-pointer" onClick={(event) => handleStorageServiceUpdate(event, storage)}>
            {storage.name}
          </span>
          <Radio value={storage.id} checked={storageServiceId === storage.id} onChange={handleActiveStorageServiceChanged} />
        </label>
      ))}
      <label className="w-full my-2 flex flex-row justify-between items-center">
        <span className="mr-2 text-sm">{t("common.database")}</span>
        <Radio value={0} checked={storageServiceId === 0} onChange={handleActiveStorageServiceChanged} />
      </label>
    </div>
  );
};

export default StorageSection;
