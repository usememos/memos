import { LatLng } from "leaflet";
import { uniqBy } from "lodash-es";
import {
  FileIcon,
  ImageIcon,
  LinkIcon,
  LoaderIcon,
  type LucideIcon,
  MapPinIcon,
  Maximize2Icon,
  MicIcon,
  MoreHorizontalIcon,
  PlusIcon,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useDebounce } from "react-use";
import { LinkMemoDialog, LocationDialog } from "@/components/MemoMetadata";
import { useReverseGeocoding } from "@/components/map";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
  useDropdownMenuSubHoverDelay,
} from "@/components/ui/dropdown-menu";
import type { MemoRelation } from "@/types/proto/api/v1/memo_service_pb";
import { useTranslate } from "@/utils/i18n";
import { useFileUpload, useLinkMemo, useLocation } from "../hooks";
import { useEditorContext } from "../state";
import type { InsertMenuProps } from "../types";
import type { LocalFile } from "../types/attachment";

const InsertMenu = (props: InsertMenuProps) => {
  const t = useTranslate();
  const { state, actions, dispatch } = useEditorContext();
  const { location: initialLocation, onLocationChange, onToggleFocusMode, isUploading: isUploadingProp } = props;

  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [locationDialogOpen, setLocationDialogOpen] = useState(false);
  const [moreSubmenuOpen, setMoreSubmenuOpen] = useState(false);

  const { handleTriggerEnter, handleTriggerLeave, handleContentEnter, handleContentLeave } = useDropdownMenuSubHoverDelay(
    150,
    setMoreSubmenuOpen,
  );

  const { fileInputRef, selectingFlag, handleFileInputChange, handleUploadClick } = useFileUpload((newFiles: LocalFile[]) => {
    newFiles.forEach((file) => dispatch(actions.addLocalFile(file)));
  });

  const linkMemo = useLinkMemo({
    isOpen: linkDialogOpen,
    currentMemoName: props.memoName,
    existingRelations: state.metadata.relations,
    onAddRelation: (relation: MemoRelation) => {
      dispatch(actions.setMetadata({ relations: uniqBy([...state.metadata.relations, relation], (r) => r.relatedMemo?.name) }));
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

  const [debouncedPosition, setDebouncedPosition] = useState<LatLng | undefined>(undefined);

  useDebounce(
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
            handleLocationPositionChange(new LatLng(position.coords.latitude, position.coords.longitude));
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

  const handleToggleFocusMode = useCallback(() => {
    onToggleFocusMode?.();
    setMoreSubmenuOpen(false);
  }, [onToggleFocusMode]);

  const handleMediaUploadClick = useCallback(() => {
    handleUploadClick("image/*,video/*");
  }, [handleUploadClick]);

  const handleFileUploadClick = useCallback(() => {
    handleUploadClick();
  }, [handleUploadClick]);

  const menuItems = useMemo(
    () =>
      [
        {
          key: "upload-media",
          label: t("attachment-library.tabs.media"),
          icon: ImageIcon,
          onClick: handleMediaUploadClick,
        },
        {
          key: "record-audio",
          label: t("editor.audio-recorder.trigger"),
          icon: MicIcon,
          onClick: () => props.onAudioRecorderClick?.(),
        },
        {
          key: "upload-file",
          label: t("common.file"),
          icon: FileIcon,
          onClick: handleFileUploadClick,
        },
        {
          key: "link",
          label: t("editor.insert-menu.link-memo"),
          icon: LinkIcon,
          onClick: handleOpenLinkDialog,
        },
        {
          key: "location",
          label: t("editor.insert-menu.add-location"),
          icon: MapPinIcon,
          onClick: handleLocationClick,
        },
      ] satisfies Array<{ key: string; label: string; icon: LucideIcon; onClick: () => void }>,
    [handleFileUploadClick, handleLocationClick, handleMediaUploadClick, handleOpenLinkDialog, props, t],
  );

  return (
    <>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon" className="shadow-none" disabled={isUploading}>
            {isUploading ? <LoaderIcon className="size-4 animate-spin" /> : <PlusIcon className="size-4" />}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          {menuItems.slice(0, 3).map((item) => (
            <DropdownMenuItem key={item.key} onClick={item.onClick}>
              <item.icon className="w-4 h-4" />
              {item.label}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          {menuItems.slice(3).map((item) => (
            <DropdownMenuItem key={item.key} onClick={item.onClick}>
              <item.icon className="w-4 h-4" />
              {item.label}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          {/* View submenu with Focus Mode */}
          <DropdownMenuSub open={moreSubmenuOpen} onOpenChange={setMoreSubmenuOpen}>
            <DropdownMenuSubTrigger onPointerEnter={handleTriggerEnter} onPointerLeave={handleTriggerLeave}>
              <MoreHorizontalIcon className="w-4 h-4" />
              {t("common.more")}
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent onPointerEnter={handleContentEnter} onPointerLeave={handleContentLeave}>
              <DropdownMenuItem onClick={handleToggleFocusMode}>
                <Maximize2Icon className="w-4 h-4" />
                {t("editor.focus-mode")}
              </DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <div className="px-2 py-1 text-xs text-muted-foreground opacity-80">{t("editor.slash-commands")}</div>
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
