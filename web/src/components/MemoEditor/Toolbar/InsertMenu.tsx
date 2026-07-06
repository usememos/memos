import { uniqBy } from "lodash-es";
import { CheckIcon, FileIcon, ImageIcon, LinkIcon, LoaderIcon, MapPinIcon, Maximize2Icon, MicIcon, PlusIcon, TypeIcon } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { LinkMemoDialog, LocationDialog } from "@/components/MemoMetadata";
import type { MapPoint } from "@/components/map/types";
import { useReverseGeocoding } from "@/components/map/useReverseGeocoding";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useDebouncedEffect } from "@/hooks";
import type { MemoRelation } from "@/types/proto/api/v1/memo_service_pb";
import { useTranslate } from "@/utils/i18n";
import { useFileUpload, useLinkMemo, useLocation } from "../hooks";
import { useEditorContext, useEditorSelector } from "../state";
import type { InsertMenuProps } from "../types";
import type { LocalFile } from "../types/attachment";

const InsertMenu = (props: InsertMenuProps) => {
  const t = useTranslate();
  const { actions, dispatch } = useEditorContext();
  const relations = useEditorSelector((s) => s.metadata.relations);
  const {
    location: initialLocation,
    onLocationChange,
    onToggleFocusMode,
    onToggleFormattingToolbar,
    isFormattingToolbarVisible,
    isUploading: isUploadingProp,
  } = props;

  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [locationDialogOpen, setLocationDialogOpen] = useState(false);

  const { fileInputRef, selectingFlag, handleFileInputChange, handleUploadClick } = useFileUpload((newFiles: LocalFile[]) => {
    newFiles.forEach((file) => dispatch(actions.addLocalFile(file)));
  });

  const linkMemo = useLinkMemo({
    isOpen: linkDialogOpen,
    currentMemoName: props.memoName,
    existingRelations: relations,
    onAddRelation: (relation: MemoRelation) => {
      dispatch(actions.setMetadata({ relations: uniqBy([...relations, relation], (r) => r.relatedMemo?.name) }));
      setLinkDialogOpen(false);
    },
  });

  const location = useLocation(props.location);
  const {
    state: locationState,
    locationInitialized,
    handlePositionChange: handleLocationPositionChange,
    getLocation,
    reset: locationReset,
    updateCoordinate,
    setPlaceholder,
  } = location;

  const [debouncedPosition, setDebouncedPosition] = useState<MapPoint | undefined>(undefined);

  useDebouncedEffect(
    () => {
      setDebouncedPosition(locationState.position);
    },
    1000,
    [locationState.position],
  );

  const { data: displayName } = useReverseGeocoding(debouncedPosition?.lat, debouncedPosition?.lng);

  useEffect(() => {
    if (displayName) {
      setPlaceholder(displayName);
    }
  }, [displayName, setPlaceholder]);

  const isUploading = selectingFlag || isUploadingProp;

  const handleOpenLinkDialog = useCallback(() => {
    setLinkDialogOpen(true);
  }, []);

  const handleLocationClick = useCallback(() => {
    setLocationDialogOpen(true);
    if (!initialLocation && !locationInitialized) {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            handleLocationPositionChange({ lat: position.coords.latitude, lng: position.coords.longitude });
          },
          (error) => {
            console.error("Geolocation error:", error);
          },
        );
      }
    }
  }, [initialLocation, locationInitialized, handleLocationPositionChange]);

  const handleLocationConfirm = useCallback(() => {
    const newLocation = getLocation();
    if (newLocation) {
      onLocationChange(newLocation);
      setLocationDialogOpen(false);
    }
  }, [getLocation, onLocationChange]);

  const handleLocationCancel = useCallback(() => {
    locationReset();
    setLocationDialogOpen(false);
  }, [locationReset]);

  const handleMediaUploadClick = useCallback(() => {
    handleUploadClick("image/*,video/*");
  }, [handleUploadClick]);

  const handleFileUploadClick = useCallback(() => {
    handleUploadClick();
  }, [handleUploadClick]);

  // Insert actions (add content).
  const insertItems = [
    { key: "media", label: t("attachment-library.tabs.media"), icon: ImageIcon, onClick: handleMediaUploadClick },
    { key: "audio", label: t("editor.audio-recorder.trigger"), icon: MicIcon, onClick: props.onAudioRecorderClick },
    { key: "file", label: t("common.file"), icon: FileIcon, onClick: handleFileUploadClick },
    { key: "link", label: t("editor.insert-menu.link-memo"), icon: LinkIcon, onClick: handleOpenLinkDialog },
    { key: "location", label: t("editor.insert-menu.add-location"), icon: MapPinIcon, onClick: handleLocationClick },
  ];

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="secondary" size="icon" disabled={isUploading}>
            {isUploading ? <LoaderIcon className="size-4 animate-spin" /> : <PlusIcon className="size-4" />}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          {insertItems.map((item) => (
            <DropdownMenuItem key={item.key} onClick={item.onClick}>
              <item.icon className="w-4 h-4" />
              {item.label}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          {/* View toggles: focus mode + formatting-toolbar visibility. */}
          <DropdownMenuItem onClick={onToggleFocusMode}>
            <Maximize2Icon className="w-4 h-4" />
            {t("editor.focus-mode")}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onToggleFormattingToolbar}>
            <TypeIcon className="w-4 h-4" />
            {t("editor.formatting-toolbar")}
            {isFormattingToolbarVisible && <CheckIcon className="w-4 h-4 ml-auto" />}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Hidden file input */}
      <input
        className="hidden"
        ref={fileInputRef}
        disabled={isUploading}
        onChange={handleFileInputChange}
        type="file"
        multiple={true}
        accept="*"
      />

      <LinkMemoDialog
        open={linkDialogOpen}
        onOpenChange={setLinkDialogOpen}
        searchText={linkMemo.searchText}
        onSearchChange={linkMemo.setSearchText}
        filteredMemos={linkMemo.filteredMemos}
        isFetching={linkMemo.isFetching}
        onSelectMemo={linkMemo.addMemoRelation}
        isAlreadyLinked={linkMemo.isAlreadyLinked}
      />

      <LocationDialog
        open={locationDialogOpen}
        onOpenChange={setLocationDialogOpen}
        state={locationState}
        onPositionChange={handleLocationPositionChange}
        onUpdateCoordinate={updateCoordinate}
        onPlaceholderChange={setPlaceholder}
        onCancel={handleLocationCancel}
        onConfirm={handleLocationConfirm}
      />
    </>
  );
};

export default InsertMenu;
