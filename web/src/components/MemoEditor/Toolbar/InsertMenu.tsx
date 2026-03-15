import { LatLng } from "leaflet";
import { uniqBy } from "lodash-es";
import { FileIcon, ImageIcon, LinkIcon, LoaderIcon, MapPinIcon, Maximize2Icon, MoreHorizontal } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useDebounce } from "react-use";
import { useReverseGeocoding } from "@/components/map";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { MemoRelation } from "@/types/proto/api/v1/memo_service_pb";
import { useTranslate } from "@/utils/i18n";
import { LinkMemoDialog, LocationDialog } from "../components";
import { useFileUpload, useLinkMemo, useLocation } from "../hooks";
import { useEditorContext } from "../state";
import type { InsertMenuProps } from "../types";
import type { LocalFile } from "../types/attachment";

const InsertMenu = (props: InsertMenuProps & { compact?: boolean }) => {
  const t = useTranslate();
  const { state, actions, dispatch } = useEditorContext();
  const { location: initialLocation, onLocationChange, onToggleFocusMode, isUploading: isUploadingProp } = props;

  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [locationDialogOpen, setLocationDialogOpen] = useState(false);

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

  const [debouncedPosition, setDebouncedPosition] = useState<LatLng | undefined>(undefined);

  useDebounce(
    () => {
      setDebouncedPosition(location.state.position);
    },
    1000,
    [location.state.position],
  );

  const { data: displayName } = useReverseGeocoding(debouncedPosition?.lat, debouncedPosition?.lng);

  useEffect(() => {
    if (displayName) {
      location.setPlaceholder(displayName);
    }
  }, [displayName]);

  const isUploading = selectingFlag || isUploadingProp;

  const handleOpenLinkDialog = useCallback(() => {
    setLinkDialogOpen(true);
  }, []);

  const handleLocationClick = useCallback(() => {
    setLocationDialogOpen(true);
    if (!initialLocation && !location.locationInitialized) {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            location.handlePositionChange(new LatLng(position.coords.latitude, position.coords.longitude));
          },
          (error) => {
            console.error("Geolocation error:", error);
          },
        );
      }
    }
  }, [initialLocation, location]);

  const handleLocationConfirm = useCallback(() => {
    const newLocation = location.getLocation();
    if (newLocation) {
      onLocationChange(newLocation);
      setLocationDialogOpen(false);
    }
  }, [location, onLocationChange]);

  const handleLocationCancel = useCallback(() => {
    location.reset();
    setLocationDialogOpen(false);
  }, [location]);

  const handlePositionChange = useCallback(
    (position: LatLng) => {
      location.handlePositionChange(position);
    },
    [location],
  );

  const handleToggleFocusMode = useCallback(() => {
    onToggleFocusMode?.();
  }, [onToggleFocusMode]);

  const handleImageUploadClick = useCallback(() => {
    handleUploadClick({ imagesOnly: true });
  }, [handleUploadClick]);

  return (
    <>
      {/* Flat button group for file upload, link memo, and location */}
      <div className="flex flex-row gap-2">
        {/* If compact is true, render a dropdown menu trigger to avoid overflow */}
        {props.compact ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="px-2" title={t("common.collapse")} aria-label={t("common.collapse")}>
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>

            <DropdownMenuContent align="start">
              <DropdownMenuItem
                onClick={() => {
                  handleImageUploadClick();
                }}
              >
                <ImageIcon className="size-4" /> {t("common.image")}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  handleUploadClick();
                }}
              >
                <FileIcon className="size-4" /> {t("common.upload")}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  handleOpenLinkDialog();
                }}
              >
                <LinkIcon className="size-4" /> {t("tooltip.link-memo")}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  handleLocationClick();
                }}
              >
                <MapPinIcon className="size-4" /> {t("tooltip.select-location")}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  handleToggleFocusMode();
                }}
              >
                <Maximize2Icon className="size-4" /> {t("editor.focus-mode")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <>
            {/* Mobile quick image picker */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleImageUploadClick}
              disabled={isUploading}
              title={t("common.image")}
              className="px-2 md:hidden"
            >
              <ImageIcon className="size-4" />
            </Button>

            {/* Upload button */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleUploadClick()}
              disabled={isUploading}
              title={t("common.upload")}
              className="px-2"
            >
              {isUploading ? <LoaderIcon className="size-4 animate-spin" /> : <FileIcon className="size-4" />}
            </Button>

            {/* Link memo button */}
            <Button variant="outline" size="sm" onClick={handleOpenLinkDialog} title={t("tooltip.link-memo")} className="px-2">
              <LinkIcon className="size-4" />
            </Button>

            {/* Location button */}
            <Button variant="outline" size="sm" onClick={handleLocationClick} title={t("tooltip.select-location")} className="px-2">
              <MapPinIcon className="size-4" />
            </Button>

            {/* Focus mode button */}
            <Button variant="outline" size="sm" onClick={handleToggleFocusMode} title={t("editor.focus-mode")} className="px-2">
              <Maximize2Icon className="size-4" />
            </Button>
          </>
        )}
      </div>

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
        state={location.state}
        locationInitialized={location.locationInitialized}
        onPositionChange={handlePositionChange}
        onUpdateCoordinate={location.updateCoordinate}
        onPlaceholderChange={location.setPlaceholder}
        onCancel={handleLocationCancel}
        onConfirm={handleLocationConfirm}
      />
    </>
  );
};

export default InsertMenu;
