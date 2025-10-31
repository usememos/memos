import { LatLng } from "leaflet";
import { uniqBy } from "lodash-es";
import { LinkIcon, LoaderIcon, MapPinIcon, PaperclipIcon, PlusIcon } from "lucide-react";
import mime from "mime";
import { observer } from "mobx-react-lite";
import { useContext, useRef, useState } from "react";
import { toast } from "react-hot-toast";
import useDebounce from "react-use/lib/useDebounce";
import LeafletMap from "@/components/LeafletMap";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { memoServiceClient } from "@/grpcweb";
import { DEFAULT_LIST_MEMOS_PAGE_SIZE } from "@/helpers/consts";
import useCurrentUser from "@/hooks/useCurrentUser";
import { attachmentStore } from "@/store";
import { extractUserIdFromName } from "@/store/common";
import { Attachment } from "@/types/proto/api/v1/attachment_service";
import { Location, Memo, MemoRelation_Memo, MemoRelation_Type } from "@/types/proto/api/v1/memo_service";
import { useTranslate } from "@/utils/i18n";
import { MemoEditorContext } from "../types";

interface Props {
  isUploading?: boolean;
  location?: Location;
  onLocationChange: (location?: Location) => void;
}

const InsertMenu = observer((props: Props) => {
  const t = useTranslate();
  const context = useContext(MemoEditorContext);
  const user = useCurrentUser();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Upload state
  const [uploadingFlag, setUploadingFlag] = useState(false);

  // Link memo state
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [isFetching, setIsFetching] = useState(true);
  const [fetchedMemos, setFetchedMemos] = useState<Memo[]>([]);

  // Location state
  const [locationDialogOpen, setLocationDialogOpen] = useState(false);
  const [locationInitialized, setLocationInitialized] = useState(false);
  const [locationPlaceholder, setLocationPlaceholder] = useState(props.location?.placeholder || "");
  const [locationPosition, setLocationPosition] = useState<LatLng | undefined>(
    props.location ? new LatLng(props.location.latitude, props.location.longitude) : undefined,
  );
  const [latInput, setLatInput] = useState(props.location ? String(props.location.latitude) : "");
  const [lngInput, setLngInput] = useState(props.location ? String(props.location.longitude) : "");

  const isUploading = uploadingFlag || props.isUploading;

  // File upload handler
  const handleFileInputChange = async () => {
    if (!fileInputRef.current || !fileInputRef.current.files || fileInputRef.current.files.length === 0) {
      return;
    }
    if (uploadingFlag) {
      return;
    }

    setUploadingFlag(true);

    const createdAttachmentList: Attachment[] = [];
    try {
      if (!fileInputRef.current || !fileInputRef.current.files) {
        return;
      }
      for (const file of fileInputRef.current.files) {
        const { name: filename, size, type } = file;
        const buffer = new Uint8Array(await file.arrayBuffer());
        const attachment = await attachmentStore.createAttachment({
          attachment: Attachment.fromPartial({
            filename,
            size,
            type: type || mime.getType(filename) || "text/plain",
            content: buffer,
          }),
          attachmentId: "",
        });
        createdAttachmentList.push(attachment);
      }
    } catch (error: any) {
      console.error(error);
      toast.error(error.details);
    }

    context.setAttachmentList([...context.attachmentList, ...createdAttachmentList]);
    setUploadingFlag(false);
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  // Link memo handlers
  const filteredMemos = fetchedMemos.filter(
    (memo) => memo.name !== context.memoName && !context.relationList.some((relation) => relation.relatedMemo?.name === memo.name),
  );

  useDebounce(
    async () => {
      if (!linkDialogOpen) return;

      setIsFetching(true);
      try {
        const conditions = [`creator_id == ${extractUserIdFromName(user.name)}`];
        if (searchText) {
          conditions.push(`content.contains("${searchText}")`);
        }
        const { memos } = await memoServiceClient.listMemos({
          filter: conditions.join(" && "),
          pageSize: DEFAULT_LIST_MEMOS_PAGE_SIZE,
        });
        setFetchedMemos(memos);
      } catch (error: any) {
        toast.error(error.details);
        console.error(error);
      }
      setIsFetching(false);
    },
    300,
    [linkDialogOpen, searchText],
  );

  const getHighlightedContent = (content: string) => {
    const index = content.toLowerCase().indexOf(searchText.toLowerCase());
    if (index === -1) {
      return content;
    }
    let before = content.slice(0, index);
    if (before.length > 20) {
      before = "..." + before.slice(before.length - 20);
    }
    const highlighted = content.slice(index, index + searchText.length);
    let after = content.slice(index + searchText.length);
    if (after.length > 20) {
      after = after.slice(0, 20) + "...";
    }

    return (
      <>
        {before}
        <mark className="font-medium">{highlighted}</mark>
        {after}
      </>
    );
  };

  const addMemoRelation = (memo: Memo) => {
    context.setRelationList(
      uniqBy(
        [
          {
            memo: MemoRelation_Memo.fromPartial({ name: memo.name }),
            relatedMemo: MemoRelation_Memo.fromPartial({ name: memo.name }),
            type: MemoRelation_Type.REFERENCE,
          },
          ...context.relationList,
        ].filter((relation) => relation.relatedMemo !== context.memoName),
        "relatedMemo",
      ),
    );
    setLinkDialogOpen(false);
    setSearchText("");
  };

  const handleLinkMemoClick = () => {
    setLinkDialogOpen(true);
  };

  // Location handlers
  const handleLocationClick = () => {
    setLocationDialogOpen(true);
    if (!props.location && !locationInitialized) {
      const handleError = (error: any) => {
        setLocationInitialized(true);
        console.error("Geolocation error:", error);
      };

      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const lat = position.coords.latitude;
            const lng = position.coords.longitude;
            setLocationPosition(new LatLng(lat, lng));
            setLatInput(String(lat));
            setLngInput(String(lng));
            setLocationInitialized(true);
          },
          (error) => {
            handleError(error);
          },
        );
      } else {
        handleError("Geolocation is not supported by this browser.");
      }
    }
  };

  const handleLocationConfirm = () => {
    if (locationPosition && locationPlaceholder.trim().length > 0) {
      props.onLocationChange(
        Location.fromPartial({
          placeholder: locationPlaceholder,
          latitude: locationPosition.lat,
          longitude: locationPosition.lng,
        }),
      );
      setLocationDialogOpen(false);
    }
  };

  const handleLocationCancel = () => {
    setLocationDialogOpen(false);
    // Reset to current location
    if (props.location) {
      setLocationPlaceholder(props.location.placeholder);
      setLocationPosition(new LatLng(props.location.latitude, props.location.longitude));
      setLatInput(String(props.location.latitude));
      setLngInput(String(props.location.longitude));
    }
  };

  // Update position when lat/lng inputs change
  const handleLatChange = (value: string) => {
    setLatInput(value);
    const lat = parseFloat(value);
    const lng = parseFloat(lngInput);
    if (Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      setLocationPosition(new LatLng(lat, lng));
    }
  };

  const handleLngChange = (value: string) => {
    setLngInput(value);
    const lat = parseFloat(latInput);
    const lng = parseFloat(value);
    if (Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      setLocationPosition(new LatLng(lat, lng));
    }
  };

  // Reverse geocoding when position changes
  const handlePositionChange = (position: LatLng) => {
    setLocationPosition(position);
    setLatInput(String(position.lat));
    setLngInput(String(position.lng));

    const lat = position.lat;
    const lng = position.lng;

    fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`)
      .then((response) => response.json())
      .then((data) => {
        if (data && data.display_name) {
          setLocationPlaceholder(data.display_name);
        } else {
          setLocationPlaceholder(`${lat.toFixed(6)}, ${lng.toFixed(6)}`);
        }
      })
      .catch((error) => {
        console.error("Failed to fetch reverse geocoding data:", error);
        setLocationPlaceholder(`${lat.toFixed(6)}, ${lng.toFixed(6)}`);
      });
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon" className="shadow-none" disabled={isUploading}>
            {isUploading ? <LoaderIcon className="size-4 animate-spin" /> : <PlusIcon className="size-4" />}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem onClick={handleUploadClick}>
            <PaperclipIcon className="w-4 h-4" />
            {t("common.upload")}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleLinkMemoClick}>
            <LinkIcon className="w-4 h-4" />
            {t("tooltip.link-memo")}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleLocationClick}>
            <MapPinIcon className="w-4 h-4" />
            {t("tooltip.select-location")}
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

      {/* Link memo dialog */}
      <Dialog open={linkDialogOpen} onOpenChange={setLinkDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("tooltip.link-memo")}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <Input
              placeholder={t("reference.search-placeholder")}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className="!text-sm"
            />
            <div className="max-h-[300px] overflow-y-auto border rounded-md">
              {filteredMemos.length === 0 ? (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  {isFetching ? "Loading..." : t("reference.no-memos-found")}
                </div>
              ) : (
                filteredMemos.map((memo) => (
                  <div
                    key={memo.name}
                    className="relative flex cursor-pointer items-start gap-2 border-b last:border-b-0 px-3 py-2 hover:bg-accent hover:text-accent-foreground"
                    onClick={() => addMemoRelation(memo)}
                  >
                    <div className="w-full flex flex-col justify-start items-start">
                      <p className="text-xs text-muted-foreground select-none">{memo.displayTime?.toLocaleString()}</p>
                      <p className="mt-0.5 text-sm leading-5 line-clamp-2">
                        {searchText ? getHighlightedContent(memo.content) : memo.snippet}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Location dialog */}
      <Dialog open={locationDialogOpen} onOpenChange={setLocationDialogOpen}>
        <DialogContent className="max-w-[min(28rem,calc(100vw-2rem))]">
          <DialogHeader>
            <DialogTitle>{t("tooltip.select-location")}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <div className="w-full h-64 overflow-hidden rounded-md bg-muted/30">
              <LeafletMap key={JSON.stringify(locationInitialized)} latlng={locationPosition} onChange={handlePositionChange} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1">
                <Label htmlFor="memo-location-lat" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Lat
                </Label>
                <Input
                  id="memo-location-lat"
                  placeholder="Lat"
                  type="number"
                  step="any"
                  min="-90"
                  max="90"
                  value={latInput}
                  onChange={(e) => handleLatChange(e.target.value)}
                  className="h-9"
                />
              </div>
              <div className="grid gap-1">
                <Label htmlFor="memo-location-lng" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Lng
                </Label>
                <Input
                  id="memo-location-lng"
                  placeholder="Lng"
                  type="number"
                  step="any"
                  min="-180"
                  max="180"
                  value={lngInput}
                  onChange={(e) => handleLngChange(e.target.value)}
                  className="h-9"
                />
              </div>
            </div>
            <div className="grid gap-1">
              <Label htmlFor="memo-location-placeholder" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {t("tooltip.select-location")}
              </Label>
              <Textarea
                id="memo-location-placeholder"
                placeholder="Choose a position first."
                value={locationPlaceholder}
                disabled={!locationPosition}
                onChange={(e) => setLocationPlaceholder(e.target.value)}
                className="min-h-16"
              />
            </div>
            <div className="w-full flex items-center justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={handleLocationCancel}>
                {t("common.cancel")}
              </Button>
              <Button size="sm" onClick={handleLocationConfirm} disabled={!locationPosition || locationPlaceholder.trim().length === 0}>
                {t("common.confirm")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
});

export default InsertMenu;
