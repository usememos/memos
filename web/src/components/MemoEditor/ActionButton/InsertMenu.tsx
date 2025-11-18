import { LatLng } from "leaflet";
import { uniqBy } from "lodash-es";
import { FileIcon, LinkIcon, LoaderIcon, MapPinIcon, Maximize2Icon, MicIcon, MoreHorizontalIcon, PlusIcon, XIcon } from "lucide-react";
import { observer } from "mobx-react-lite";
import { useContext, useState } from "react";
import { toast } from "react-hot-toast";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { attachmentStore } from "@/store";
import { Attachment } from "@/types/proto/api/v1/attachment_service";
import { Location, MemoRelation } from "@/types/proto/api/v1/memo_service";
import { useTranslate } from "@/utils/i18n";
import { MemoEditorContext } from "../types";
import { LinkMemoDialog } from "./InsertMenu/LinkMemoDialog";
import { LocationDialog } from "./InsertMenu/LocationDialog";
import { useAudioRecorder } from "./InsertMenu/useAudioRecorder";
import { useFileUpload } from "./InsertMenu/useFileUpload";
import { useLinkMemo } from "./InsertMenu/useLinkMemo";
import { useLocation } from "./InsertMenu/useLocation";

interface Props {
  isUploading?: boolean;
  location?: Location;
  onLocationChange: (location?: Location) => void;
  onToggleFocusMode?: () => void;
}

const InsertMenu = observer((props: Props) => {
  const t = useTranslate();
  const context = useContext(MemoEditorContext);

  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [locationDialogOpen, setLocationDialogOpen] = useState(false);

  const { fileInputRef, uploadingFlag, handleFileInputChange, handleUploadClick } = useFileUpload((attachments: Attachment[]) => {
    context.setAttachmentList([...context.attachmentList, ...attachments]);
  });

  const linkMemo = useLinkMemo({
    isOpen: linkDialogOpen,
    currentMemoName: context.memoName,
    existingRelations: context.relationList,
    onAddRelation: (relation: MemoRelation) => {
      context.setRelationList(uniqBy([...context.relationList, relation], (r) => r.relatedMemo?.name));
      setLinkDialogOpen(false);
    },
  });

  const location = useLocation(props.location);
  const audioRecorder = useAudioRecorder();

  const isUploading = uploadingFlag || props.isUploading;

  const handleLocationClick = () => {
    setLocationDialogOpen(true);
    if (!props.location && !location.locationInitialized) {
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
  };

  const handleLocationConfirm = () => {
    const newLocation = location.getLocation();
    if (newLocation) {
      props.onLocationChange(newLocation);
      setLocationDialogOpen(false);
    }
  };

  const handleLocationCancel = () => {
    location.reset();
    setLocationDialogOpen(false);
  };

  const handlePositionChange = (position: LatLng) => {
    location.handlePositionChange(position);

    fetch(`https://nominatim.openstreetmap.org/reverse?lat=${position.lat}&lon=${position.lng}&format=json`, {
      headers: {
        "User-Agent": "Memos/1.0 (https://github.com/usememos/memos)",
        Accept: "application/json",
      },
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
      })
      .then((data) => {
        if (data?.display_name) {
          location.setPlaceholder(data.display_name);
        } else {
          location.setPlaceholder(`${position.lat.toFixed(6)}, ${position.lng.toFixed(6)}`);
        }
      })
      .catch((error) => {
        console.error("Failed to fetch reverse geocoding data:", error);
        location.setPlaceholder(`${position.lat.toFixed(6)}, ${position.lng.toFixed(6)}`);
      });
  };

  const handleStopRecording = async () => {
    try {
      const blob = await audioRecorder.stopRecording();
      const filename = `recording-${Date.now()}.webm`;
      const file = new File([blob], filename, { type: "audio/webm" });
      const { name, size, type } = file;
      const buffer = new Uint8Array(await file.arrayBuffer());

      const attachment = await attachmentStore.createAttachment({
        attachment: Attachment.fromPartial({
          filename: name,
          size,
          type,
          content: buffer,
        }),
        attachmentId: "",
      });
      context.setAttachmentList([...context.attachmentList, attachment]);
    } catch (error: any) {
      console.error("Failed to upload audio recording:", error);
      toast.error(error.details || "Failed to upload audio recording");
    }
  };

  return (
    <>
      {audioRecorder.isRecording ? (
        <div className="flex flex-row items-center gap-2 mr-2">
          <div className="flex flex-row items-center px-2 py-1 rounded-md bg-red-50 text-red-600 border border-red-200">
            <div className={`w-2 h-2 rounded-full bg-red-500 mr-2 ${!audioRecorder.isPaused ? "animate-pulse" : ""}`} />
            <span className="font-mono text-sm">{new Date(audioRecorder.recordingTime * 1000).toISOString().substr(14, 5)}</span>
          </div>
          <Button variant="outline" size="icon" onClick={audioRecorder.togglePause} className="shrink-0">
            {audioRecorder.isPaused ? <MicIcon className="w-4 h-4" /> : <span className="font-bold text-xs">||</span>}
          </Button>
          <Button variant="outline" size="icon" onClick={handleStopRecording} className="shrink-0 text-red-600 hover:text-red-700">
            <div className="w-3 h-3 bg-current rounded-sm" />
          </Button>
          <Button variant="ghost" size="icon" onClick={audioRecorder.cancelRecording} className="shrink-0">
            <XIcon className="w-4 h-4" />
          </Button>
        </div>
      ) : (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon" className="shadow-none" disabled={isUploading}>
              {isUploading ? <LoaderIcon className="size-4 animate-spin" /> : <PlusIcon className="size-4" />}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onClick={handleUploadClick}>
              <FileIcon className="w-4 h-4" />
              {t("common.upload")}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setLinkDialogOpen(true)}>
              <LinkIcon className="w-4 h-4" />
              {t("tooltip.link-memo")}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleLocationClick}>
              <MapPinIcon className="w-4 h-4" />
              {t("tooltip.select-location")}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={audioRecorder.startRecording}>
              <MicIcon className="w-4 h-4" />
              Record Audio
            </DropdownMenuItem>
            {/* View submenu with Focus Mode */}
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <MoreHorizontalIcon className="w-4 h-4" />
                {t("common.more")}
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                <DropdownMenuItem onClick={props.onToggleFocusMode}>
                  <Maximize2Icon className="w-4 h-4" />
                  {t("editor.focus-mode")}
                  <span className="ml-auto text-xs text-muted-foreground opacity-60">⌘⇧F</span>
                </DropdownMenuItem>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          </DropdownMenuContent>
        </DropdownMenu>
      )}

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
        getHighlightedContent={linkMemo.getHighlightedContent}
      />

      <LocationDialog
        open={locationDialogOpen}
        onOpenChange={setLocationDialogOpen}
        state={location.state}
        locationInitialized={location.locationInitialized}
        onPositionChange={handlePositionChange}
        onLatChange={location.handleLatChange}
        onLngChange={location.handleLngChange}
        onPlaceholderChange={location.setPlaceholder}
        onCancel={handleLocationCancel}
        onConfirm={handleLocationConfirm}
      />
    </>
  );
});

export default InsertMenu;
